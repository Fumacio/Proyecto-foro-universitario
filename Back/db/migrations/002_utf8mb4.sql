-- Solo para bases creadas con una versión anterior de schema.sql/seed.sql.
-- Arregla dos cosas que pasan con un MySQL/MariaDB configurado en latin1 (XAMPP, por ejemplo):
--   1. Las tablas quedaron en latin1 y crear un post o comentario con un emoji da error 500.
--   2. El seed se cargó con el cliente en latin1 y las categorías y etiquetas se ven
--      rotas en la web ("FÃ­sica" en vez de "Física").
-- Se puede correr aunque la base esté bien: solo toca el texto que tiene ese patrón roto.
SET NAMES utf8mb4;
USE foro_universitario;

ALTER DATABASE foro_universitario CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE roles CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE posts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE comments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE votes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE tags CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE post_tags CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE password_resets CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE bans CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE reports CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Texto del seed guardado dos veces como UTF-8: "Ã" (C3 83) o "Â" (C3 82) en los bytes.
-- La comparación es binaria a propósito: con una collation sin acentos "Ã" sería igual a "a".
UPDATE categories
SET name = CONVERT(CAST(CONVERT(name USING latin1) AS BINARY) USING utf8mb4)
WHERE CAST(name AS BINARY) LIKE CONCAT('%', UNHEX('C383'), '%')
   OR CAST(name AS BINARY) LIKE CONCAT('%', UNHEX('C382'), '%');

UPDATE categories
SET description = CONVERT(CAST(CONVERT(description USING latin1) AS BINARY) USING utf8mb4)
WHERE CAST(description AS BINARY) LIKE CONCAT('%', UNHEX('C383'), '%')
   OR CAST(description AS BINARY) LIKE CONCAT('%', UNHEX('C382'), '%');

UPDATE tags
SET name = CONVERT(CAST(CONVERT(name USING latin1) AS BINARY) USING utf8mb4)
WHERE CAST(name AS BINARY) LIKE CONCAT('%', UNHEX('C383'), '%')
   OR CAST(name AS BINARY) LIKE CONCAT('%', UNHEX('C382'), '%');
