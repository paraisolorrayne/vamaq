-- ============================================================================
-- Seed: estoque inicial Vamaq Motors — 8 veículos reais (publicação inicial).
--
-- Conteúdo organizado em /Users/lorrayneparaiso/Documents/Claude/Projects/
--   Vamaq/Vamaq Motors/04 — Conteúdo/Publicacao-Inicial-Estoque/CONTEUDO-ESTOQUE.md
--
-- - Veículos 1 a 4 (Cayenne, 320 M Sport, Ram Rebel, X4 M40i): fotos prontas,
--   sobem como `published`. Imagens são carregadas pelo script
--   `scripts/seed-images.mjs`, que cria as linhas em `vehicle_images`.
-- - Veículos 5 a 8 (M Sport, 718 Boxster, Tiggo 7 Pro, Ram Night Edition):
--   ficam como `draft` até as fotos chegarem do Mateus.
--
-- Idempotente: `on conflict (slug) do nothing`.
-- ============================================================================

insert into public.vehicles (
  slug, brand, model, year, body_type, color,
  price, mileage, badge, featured,
  fuel, transmission, power,
  spec_engine, spec_acceleration, spec_top_speed, spec_doors, spec_seats,
  description, status, published_at
) values

-- 1. Porsche Cayenne Coupé Platinum Edition — 2022 (fotos prontas, publicado)
('porsche-cayenne-coupe-platinum-2022',
 'Porsche', 'Cayenne Coupé Platinum Edition', 2022, 'SUV', 'Mahagoni Metálico',
 586000, 20000, 'Destaque', true,
 'Gasolina', 'Automático', '340 cv',
 '3.0 V6 Turbo', '5,9 s (0-100km/h)', '243 km/h', 5, 5,
 'O Cayenne Coupé Platinum Edition é o que a Porsche faz quando decide misturar SUV, esportivo e exclusividade no mesmo carro. Esta unidade chega à Vamaq com apenas 20.000 km, full PPF aplicado (proteção total de pintura), pneus novos, IPVA 2026 quitado e pacote de opcionais completo de fábrica. A versão Platinum traz rodas dedicadas, acabamentos exclusivos em preto acetinado e um nível de presença que carro nenhum no segmento entrega. Procedência limpa, manutenção em dia, sem detalhes. É para quem não compra carro — escolhe.',
 'published', now()),

-- 2. BMW 320i M Sport — 2022 (fotos prontas, publicado)
('bmw-320i-m-sport-2022',
 'BMW', '320i M Sport', 2022, 'Sedan', 'Azul Portimão',
 224000, 53000, null, false,
 'Gasolina', 'Automático', '184 cv',
 '2.0 TwinPower Turbo', '7,1 s (0-100km/h)', '235 km/h', 4, 5,
 'A configuração mais desejada do 320 M Sport: Azul Portimão por fora, interior em couro conhaque por dentro. Combinação rara, daquelas que valorizam ao longo do tempo e que dificilmente você reencontra no mercado. Unidade 2022 com 53.000 km, PPF frontal aplicado, kit M Sport completo de fábrica e a dirigibilidade que consolidou o Série 3 como referência absoluta de sedan esportivo. Carro para quem entende que cor e acabamento não são detalhe — são o carro.',
 'published', now()),

-- 3. Dodge Ram 2500 Rebel — 2021 (fotos prontas, publicado)
('dodge-ram-2500-rebel-2021',
 'Dodge', 'Ram 2500 Rebel', 2021, 'Pickup', 'Cinza Granito',
 285000, 129000, null, false,
 'Diesel', 'Automático', '370 cv',
 '6.7 Cummins Turbo Diesel', null, null, 4, 5,
 'Ram 2500 Rebel 2021: pickup íntegra, segundo dono, 129.000 km com revisões em dia e calçada com pneus BFGoodrich. Motor Cummins Turbo Diesel, tração 4x4, câmbio automático e o interior premium que diferencia a versão Rebel das demais. Presença imponente, capacidade real de trabalho pesado e o conforto de uma SUV de luxo. Não é uma picape comum — é o tipo de veículo que combina força bruta com luxo, e que poucos sabem entregar como a Ram faz.',
 'published', now()),

-- 4. BMW X4 M40i — 2024 (fotos prontas, publicado)
('bmw-x4-m40i-2024',
 'BMW', 'X4 M40i', 2024, 'SUV', 'Preta (Carbon Black)',
 439000, 40000, 'Destaque', true,
 'Gasolina', 'Automático', '387 cv',
 '3.0 TwinPower Turbo (6 cilindros em linha)', '4,5 s (0-100km/h)', '250 km/h', 5, 5,
 'A X4 M40i é a definição de SUV esportivo da BMW: 387 cv, 0 a 100 km/h em 4,5 segundos, tração xDrive e o motor 3.0 TwinPower Turbo de 6 cilindros em linha — uma das melhores mecânicas já feitas pela marca. Esta unidade 2024 tem 40.000 km, revisões em concessionária, pacote M Performance de fábrica e o interior caramelo que valoriza o conjunto. Coupé de altura elevada, postura agressiva, conforto premium e os três modos de condução (Sport, Comfort, Eco Pro). Para quem quer um único carro que resolve tudo, sem abrir mão de absolutamente nada.',
 'published', now()),

-- 5. BMW M Sport — 2025 (PENDENTE: fotos + confirmar modelo exato com Mateus)
('bmw-m-sport-2025',
 'BMW', 'M Sport', 2025, 'Sedan', 'Preta',
 325000, 23000, 'Novo', false,
 'Gasolina', 'Automático', 'A confirmar',
 null, null, null, null, null,
 'BMW M Sport 2025 preta com interior claro: configuração de contraste impecável, daquelas que envelhecem bem. 23.000 km, todas as revisões feitas em concessionária e garantia de fábrica ainda vigente — praticamente um carro novo, com a vantagem de já estar pronto para sair rodando. Acabamento refinado, tecnologia BMW de última geração e o padrão esportivo que entrega presença em qualquer lugar. Para quem quer o pacote completo: performance, conforto, segurança e o nome certo no porta-malas.',
 'draft', null),

-- 6. Porsche 718 Boxster — 2020 (PENDENTE: fotos)
('porsche-718-boxster-2020',
 'Porsche', '718 Boxster', 2020, 'Conversível', 'Branca (capota vermelha)',
 449000, 21000, 'Destaque', true,
 'Gasolina', 'Automático', '300 cv',
 '2.0 Boxer Turbo (motor central)', '5,1 s (0-100km/h)', '275 km/h', 2, 2,
 'Uma das configurações mais raras do 718 Boxster: carroceria branca com capota vermelha — combinação que a Porsche faz sob demanda e que aparece pouquíssimas vezes no mercado brasileiro. 21.000 km, estado de zero, rodas em preto brilhante, faróis em LED e o motor central turbo que define o que é equilíbrio em um esportivo. Conversível de motor central, distribuição de peso quase perfeita e aquela sensação que só Porsche entrega ao volante. Exclusividade que se vê de longe e se sente em cada curva.',
 'draft', null),

-- 7. Chery Tiggo 7 Pro Híbrido (PENDENTE: fotos + confirmar ano/cor com Mateus)
('chery-tiggo-7-pro-hibrido',
 'Chery', 'Tiggo 7 Pro Híbrido (MHEV)', 2024, 'SUV', 'A confirmar',
 154900, 15500, null, false,
 'Híbrido', 'Automático', '156 cv',
 '1.5 Turbo MHEV', null, null, 5, 5,
 'Tiggo 7 Pro Híbrido com 15.500 km e ZERO detalhes: painel 100%, multimídia com Apple CarPlay e Android Auto, ar-condicionado digital dual zone, câmera 360°, carregador por indução, acabamento interno todo em couro, teto solar panorâmico e porta-malas de 475 L. Versão híbrida leve (MHEV) com motor 1.5 Turbo e câmbio automático CVT de 9 marchas, fabricado no Brasil e equipado com o pacote Max Drive completo: piloto adaptativo (ACC), assistente de faixa, frenagem automática de emergência, alerta de ponto cego e alerta de tráfego cruzado. SUV híbrido equipado como premium pelo preço de um intermediário. Não tem o que questionar.',
 'draft', null),

-- 8. Dodge Ram 2500 Night Edition — 2021 (PENDENTE: fotos)
('dodge-ram-2500-night-edition-2021',
 'Dodge', 'Ram 2500 Night Edition', 2021, 'Pickup', 'Preta',
 339000, 92000, 'Destaque', false,
 'Diesel', 'Automático', '370 cv',
 '6.7 Cummins Turbo Diesel', null, null, 4, 5,
 'Ram 2500 Night Edition 2021: visual 100% blackout, full PPF (proteção total de pintura) e procedência garantida. 92.000 km, impecável de conservação. O Cummins Turbo Diesel entrega torque absurdo, conforto de SUV premium e a presença que só uma picape americana tem. Não é para qualquer um: é para quem quer trabalho pesado pela manhã, jantar no melhor restaurante à noite e a mesma picape resolvendo as duas pontas. Difícil encontrar nesse nível de conservação no mercado.',
 'draft', null)

on conflict (slug) do nothing;
