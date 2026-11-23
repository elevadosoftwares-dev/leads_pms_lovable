-- Leads Credential Management System - SQL Server schema.
-- Applied automatically when the app first connects (src/server/db.server.ts), after creating
-- the database if needed. Safe to re-run: every object is created only if it does not exist.
-- Separate batches with a line containing only GO. To apply by hand:
--   sqlcmd -S <server> -U <user> -P <password> -d new_leads_pms -i database/schema.sql

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
CREATE TABLE dbo.users (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_users PRIMARY KEY DEFAULT NEWID(),
  email         NVARCHAR(320)    NOT NULL CONSTRAINT uq_users_email UNIQUE,
  password_hash NVARCHAR(256)    NOT NULL,
  department    NVARCHAR(40)     NOT NULL CONSTRAINT df_users_department DEFAULT N'Admin',
  is_admin      BIT              NOT NULL CONSTRAINT df_users_is_admin DEFAULT 0,
  created_at    DATETIME2(3)     NOT NULL CONSTRAINT df_users_created_at DEFAULT SYSUTCDATETIME()
);

-- Login sessions. token_hash is the SHA-256 of the random token kept in the browser cookie.
IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
CREATE TABLE dbo.sessions (
  token_hash CHAR(64)         NOT NULL CONSTRAINT pk_sessions PRIMARY KEY,
  user_id    UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_sessions_user REFERENCES dbo.users(id) ON DELETE CASCADE,
  expires_at DATETIME2(3)     NOT NULL,
  created_at DATETIME2(3)     NOT NULL CONSTRAINT df_sessions_created_at DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_sessions_user_id')
  CREATE INDEX ix_sessions_user_id ON dbo.sessions(user_id);

IF OBJECT_ID(N'dbo.departments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.departments (
    name       NVARCHAR(40) NOT NULL CONSTRAINT pk_departments PRIMARY KEY
      CONSTRAINT ck_departments_name CHECK (LEN(name) BETWEEN 1 AND 40),
    created_at DATETIME2(3) NOT NULL CONSTRAINT df_departments_created_at DEFAULT SYSUTCDATETIME()
  );
  INSERT INTO dbo.departments (name) VALUES (N'HR'), (N'Accounts'), (N'Safety'), (N'Admin');
END

IF OBJECT_ID(N'dbo.entities', N'U') IS NULL
CREATE TABLE dbo.entities (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_entities PRIMARY KEY DEFAULT NEWID(),
  name       NVARCHAR(100)    NOT NULL CONSTRAINT uq_entities_name UNIQUE
    CONSTRAINT ck_entities_name CHECK (LEN(name) BETWEEN 1 AND 100),
  created_at DATETIME2(3)     NOT NULL CONSTRAINT df_entities_created_at DEFAULT SYSUTCDATETIME()
);

-- password_enc holds the AES-256-GCM encrypted password (see src/server/crypto.server.ts).
IF OBJECT_ID(N'dbo.credentials', N'U') IS NULL
CREATE TABLE dbo.credentials (
  id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_credentials PRIMARY KEY DEFAULT NEWID(),
  entity_id         UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_credentials_entity REFERENCES dbo.entities(id) ON DELETE CASCADE,
  site_url          NVARCHAR(2000)   NOT NULL CONSTRAINT df_credentials_site_url DEFAULT N'',
  login_user_id     NVARCHAR(500)    NOT NULL,
  password_enc      NVARCHAR(MAX)    NOT NULL,
  registered_email  NVARCHAR(320)    NULL,
  registered_mobile NVARCHAR(50)     NULL,
  client_name       NVARCHAR(15)     NOT NULL,
  purpose           NVARCHAR(1000)   NULL,
  contact_name      NVARCHAR(200)    NULL,
  contact_email     NVARCHAR(320)    NULL,
  contact_tel       NVARCHAR(50)     NULL,
  created_by        UNIQUEIDENTIFIER NULL
    CONSTRAINT fk_credentials_created_by REFERENCES dbo.users(id) ON DELETE SET NULL,
  created_at        DATETIME2(3)     NOT NULL CONSTRAINT df_credentials_created_at DEFAULT SYSUTCDATETIME(),
  updated_at        DATETIME2(3)     NOT NULL CONSTRAINT df_credentials_updated_at DEFAULT SYSUTCDATETIME()
);

-- Departments a credential is shared with. Like the original text[] column, names are not
-- foreign keys, so deleting a department in Masters leaves existing tags in place.
IF OBJECT_ID(N'dbo.credential_departments', N'U') IS NULL
CREATE TABLE dbo.credential_departments (
  credential_id UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_credential_departments_credential REFERENCES dbo.credentials(id) ON DELETE CASCADE,
  department    NVARCHAR(40)     NOT NULL,
  CONSTRAINT pk_credential_departments PRIMARY KEY (credential_id, department)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_credential_departments_department')
  CREATE INDEX ix_credential_departments_department ON dbo.credential_departments(department);

-- ---------------------------------------------------------------------------------------------
-- Upgrades for the v2 features. Each step only adds what is missing, so an existing database
-- keeps all of its rows and simply gains the new columns and tables on the next start.
-- ---------------------------------------------------------------------------------------------

-- Disabled accounts: 0 blocks sign-in and ends existing sessions immediately.
IF COL_LENGTH(N'dbo.users', N'is_active') IS NULL
  ALTER TABLE dbo.users ADD is_active BIT NOT NULL CONSTRAINT df_users_is_active DEFAULT 1;

-- Physical/digital token or keys held for a credential, and who holds them.
IF COL_LENGTH(N'dbo.credentials', N'token_type') IS NULL
  ALTER TABLE dbo.credentials ADD token_type NVARCHAR(40) NULL;
IF COL_LENGTH(N'dbo.credentials', N'token_holder') IS NULL
  ALTER TABLE dbo.credentials ADD token_holder NVARCHAR(200) NULL;

-- One-time password reset links. token_hash is the SHA-256 of the token sent in the link.
IF OBJECT_ID(N'dbo.password_resets', N'U') IS NULL
CREATE TABLE dbo.password_resets (
  token_hash CHAR(64)         NOT NULL CONSTRAINT pk_password_resets PRIMARY KEY,
  user_id    UNIQUEIDENTIFIER NOT NULL
    CONSTRAINT fk_password_resets_user REFERENCES dbo.users(id) ON DELETE CASCADE,
  expires_at DATETIME2(3)     NOT NULL,
  created_at DATETIME2(3)     NOT NULL CONSTRAINT df_password_resets_created_at DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_password_resets_user_id')
  CREATE INDEX ix_password_resets_user_id ON dbo.password_resets(user_id);

-- The single saved AI assistant conversation per user (UI messages as JSON).
IF OBJECT_ID(N'dbo.ai_chat_conversations', N'U') IS NULL
CREATE TABLE dbo.ai_chat_conversations (
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_ai_chat_conversations PRIMARY KEY
    CONSTRAINT fk_ai_chat_conversations_user REFERENCES dbo.users(id) ON DELETE CASCADE,
  messages   NVARCHAR(MAX)    NOT NULL CONSTRAINT df_ai_chat_conversations_messages DEFAULT N'[]',
  updated_at DATETIME2(3)     NOT NULL CONSTRAINT df_ai_chat_conversations_updated_at DEFAULT SYSUTCDATETIME()
);
GO

-- Atomically changes a user's department, role and active state. An application lock serialises
-- concurrent calls so two administrators cannot demote/disable each other and leave none active.
CREATE OR ALTER PROCEDURE dbo.manage_vault_user
  @actor_id   UNIQUEIDENTIFIER,
  @user_id    UNIQUEIDENTIFIER,
  @department NVARCHAR(40),
  @is_admin   BIT,
  @is_active  BIT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  BEGIN TRY
  BEGIN TRANSACTION;
  EXEC sp_getapplock @Resource = N'manage_vault_user', @LockMode = N'Exclusive', @LockOwner = N'Transaction';

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @actor_id AND is_admin = 1 AND is_active = 1)
    THROW 50001, N'Only administrators can do this.', 1;
  IF @is_admin IS NULL OR @is_active IS NULL
    THROW 50002, N'Missing account settings.', 1;
  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @user_id)
    THROW 50003, N'User not found.', 1;
  IF NOT EXISTS (SELECT 1 FROM dbo.departments WHERE name = @department)
    THROW 50004, N'Select a valid department.', 1;
  IF @user_id = @actor_id AND (@is_admin = 0 OR @is_active = 0)
    THROW 50005, N'You cannot remove your own administrator access.', 1;
  IF (@is_admin = 0 OR @is_active = 0)
     AND EXISTS (SELECT 1 FROM dbo.users WHERE id = @user_id AND is_admin = 1 AND is_active = 1)
     AND (SELECT COUNT(*) FROM dbo.users WHERE is_admin = 1 AND is_active = 1) <= 1
    THROW 50006, N'Keep at least one active administrator.', 1;

  UPDATE dbo.users
     SET department = @department, is_admin = @is_admin, is_active = @is_active
   WHERE id = @user_id;
  -- A disabled account loses its sessions and any pending reset links straight away.
  IF @is_active = 0
  BEGIN
    DELETE FROM dbo.sessions WHERE user_id = @user_id;
    DELETE FROM dbo.password_resets WHERE user_id = @user_id;
  END

  COMMIT TRANSACTION;
  END TRY
  BEGIN CATCH
    -- Never leave a half-open transaction on the pooled connection.
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
  END CATCH
END
