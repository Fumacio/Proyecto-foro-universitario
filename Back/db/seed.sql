USE foro_universitario;

INSERT IGNORE INTO roles (name) VALUES ('admin'), ('profesor'), ('alumno');

INSERT IGNORE INTO categories (name, description, parent_id) VALUES
('Matemática', 'Departamento de Matemática', NULL),
('Análisis Matemático I', 'Derivadas, integrales, límites', 1),
('Álgebra y Geometría Analítica', 'Vectores, matrices, espacios', 1),
('Física', 'Departamento de Física', NULL),
('Física I', 'Mecánica, cinemática, dinámica', 4),
('Programación', 'Departamento de Programación', NULL),
('Algoritmos y Estructuras de Datos', 'Listas, árboles, complejidad', 6),
('Base de Datos', 'SQL, modelado relacional, NoSQL', 6);

INSERT IGNORE INTO tags (name, color) VALUES
('duda', '#F99B4A'),
('tarea', '#22c55e'),
('examen', '#ef4444'),
('práctica', '#3b82f6'),
('material', '#a855f7'),
('consulta', '#eab308');