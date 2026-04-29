-- Dados iniciais opcionais para testar o sistema
-- Execute depois do schema.sql
-- Para criar usuario de login, use senha com password_hash no PHP.
-- Exemplo:
-- $hash = password_hash('SuaSenhaForte', PASSWORD_DEFAULT);
-- INSERT INTO usuarios (nome, email, senha, ativo) VALUES ('Administrador', 'admin@empresa.com', '$hash', 1);

INSERT IGNORE INTO clientes (nome, telefone, email, predio, andar, status) VALUES
('Marina Souza', '11999887766', 'marina.souza@email.com', '1', 'Terreo', 'ativo'),
('Carlos Menezes', '11988776655', 'carlos.menezes@email.com', '2', '2 andar', 'inativo'),
('Fernanda Lima', '11977665544', 'fernanda.lima@email.com', '1', '1 andar', 'ativo');

INSERT IGNORE INTO produtos (nome, estoque, status) VALUES
('Torta de morango', 42, 'ativo'),
('Torta de limao', 18, 'ativo'),
('Torta de maracuja', 25, 'ativo');
