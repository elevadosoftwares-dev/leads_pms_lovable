-- Leads Credential Management System - SQL Server schema.
-- Applied automatically when the app first connects (src/server/db.server.ts), after creating
-- the database if needed. Safe to re-run: every object is created only if it does not exist.
-- Separate batches with a line containing only GO. To apply by hand:
--   sqlcmd -S <server> -U <user> -P <password> -d passvault -i database/schema.sql

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
