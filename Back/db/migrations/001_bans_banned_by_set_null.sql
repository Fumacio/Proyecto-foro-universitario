-- Solo para bases creadas con una versión anterior de schema.sql.
-- Antes, borrar al admin que había baneado a alguien borraba también ese ban
-- (ON DELETE CASCADE) y el usuario baneado quedaba libre.
USE foro_universitario;

ALTER TABLE bans DROP FOREIGN KEY bans_ibfk_2;
ALTER TABLE bans MODIFY banned_by INT NULL;
ALTER TABLE bans
  ADD CONSTRAINT fk_bans_banned_by FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL;
