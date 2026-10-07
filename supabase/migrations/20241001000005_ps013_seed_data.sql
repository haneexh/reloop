-- ==============================================================================
-- RE:LOOP Migration 05: PS-013 Safe Demo Seed Data
-- Problem Statement: TH2-PS-SD-013 (Community E-Waste Collection Optimizer)
-- All demo records explicitly flagged: is_simulated = true
-- Existing items (23 rows) and partners (40 rows) are completely untouched.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEED HYDERABAD COLLECTION ZONES (10 Municipal Clusters)
-- ------------------------------------------------------------------------------
INSERT INTO collection_zones (id, name, code, center_lat, center_lng, radius_km) VALUES
  ('00000000-0000-0000-0000-000000000001', 'HITEC City & Madhapur', 'ZONE-HYD-01', 17.4486, 78.3908, 4.5),
  ('00000000-0000-0000-0000-000000000002', 'Gachibowli & Financial District', 'ZONE-HYD-02', 17.4401, 78.3489, 5.0),
  ('00000000-0000-0000-0000-000000000003', 'Kondapur & Botanical Garden', 'ZONE-HYD-03', 17.4699, 78.3578, 4.0),
  ('00000000-0000-0000-0000-000000000004', 'Jubilee Hills & Film Nagar', 'ZONE-HYD-04', 17.4319, 78.4073, 4.5),
  ('00000000-0000-0000-0000-000000000005', 'Banjara Hills & Somajiguda', 'ZONE-HYD-05', 17.4156, 78.4357, 4.5),
  ('00000000-0000-0000-0000-000000000006', 'Kukatpally & KPHB Colony', 'ZONE-HYD-06', 17.4938, 78.3995, 5.0),
  ('00000000-0000-0000-0000-000000000007', 'Begumpet & Ameerpet', 'ZONE-HYD-07', 17.4447, 78.4664, 4.0),
  ('00000000-0000-0000-0000-000000000008', 'Secunderabad & Paradise', 'ZONE-HYD-08', 17.4399, 78.4983, 5.0),
  ('00000000-0000-0000-0000-000000000009', 'Charminar & Old City', 'ZONE-HYD-09', 17.3616, 78.4747, 5.5),
  ('00000000-0000-0000-0000-000000000010', 'Uppal & Habsiguda', 'ZONE-HYD-10', 17.4042, 78.5606, 6.0)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. SEED COLLECTION VEHICLES (6 Municipal Fleet Units)
-- ------------------------------------------------------------------------------
INSERT INTO vehicles (id, vehicle_code, capacity_kg, vehicle_type, status, depot_name, depot_lat, depot_lng, max_route_hours) VALUES
  ('10000000-0000-0000-0000-000000000001', 'EV-VAN-01', 400.0, 'EV_VAN', 'available', 'HITEC Central Eco-Depot', 17.4520, 78.3840, 7.5),
  ('10000000-0000-0000-0000-000000000002', 'EV-VAN-02', 400.0, 'EV_VAN', 'available', 'HITEC Central Eco-Depot', 17.4520, 78.3840, 7.5),
  ('10000000-0000-0000-0000-000000000003', 'CNG-TRUCK-01', 850.0, 'CNG_TRUCK', 'available', 'Sanathnagar Municipal Transfer Depot', 17.4580, 78.4420, 8.0),
  ('10000000-0000-0000-0000-000000000004', 'CNG-TRUCK-02', 850.0, 'CNG_TRUCK', 'available', 'Sanathnagar Municipal Transfer Depot', 17.4580, 78.4420, 8.0),
  ('10000000-0000-0000-0000-000000000005', 'MINI-TRUCK-01', 600.0, 'MINI_TRUCK', 'available', 'Secunderabad Green Logistics Yard', 17.4410, 78.5020, 8.0),
  ('10000000-0000-0000-0000-000000000006', 'MINI-TRUCK-02', 600.0, 'MINI_TRUCK', 'available', 'Cherlapally Industrial Recovery Hub', 17.4623, 78.6012, 8.0)
ON CONFLICT (vehicle_code) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. SEED CITIZEN COLLECTION REQUESTS (Realistic Spatial & Temporal Spread)
-- ------------------------------------------------------------------------------
INSERT INTO collection_requests (
  id, citizen_name, citizen_phone, address, zone_id, lat, lng, pickup_date, pickup_slot, status, priority, notes, qr_token, is_simulated, created_at
) VALUES
  -- HITEC City & Madhapur (ZONE-HYD-01) - 4 Requests
  (
    '20000000-0000-0000-0000-000000000001',
    'Arjun Rao',
    '+91-98490-11221',
    'Flat 402, My Home Bhooja, HITEC City, Hyderabad',
    '00000000-0000-0000-0000-000000000001',
    17.4415, 78.3820,
    CURRENT_DATE, '09:00 - 12:00',
    'pending', 'normal',
    '2 old desktop PCs and dead CRT monitor',
    'QR-REQ-HYD-001', true, now() - INTERVAL '2 hours'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Pooja Reddy',
    '+91-98490-33442',
    'Plot 12, Silicon Valley Layout, Madhapur, Hyderabad',
    '00000000-0000-0000-0000-000000000001',
    17.4498, 78.3912,
    CURRENT_DATE, '09:00 - 12:00',
    'pending', 'high',
    'Swollen lithium laptop batteries, urgent disposal',
    'QR-REQ-HYD-002', true, now() - INTERVAL '4 hours'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'Karthik Sharma',
    '+91-98490-55663',
    'Tower 3, Jayabheri Silicon Towers, Kothaguda, Hyderabad',
    '00000000-0000-0000-0000-000000000001',
    17.4582, 78.3725,
    CURRENT_DATE, '14:00 - 17:00',
    'scheduled', 'normal',
    'LaserJet office printer and cables',
    'QR-REQ-HYD-003', true, now() - INTERVAL '1 day'
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    'Sunita Verma',
    '+91-98490-77884',
    'Villa 18, Fortune Fields, Madhapur, Hyderabad',
    '00000000-0000-0000-0000-000000000001',
    17.4510, 78.3855,
    CURRENT_DATE - INTERVAL '1 day', '09:00 - 12:00',
    'collected', 'normal',
    'Mix of feature phones and chargers',
    'QR-REQ-HYD-004', true, now() - INTERVAL '2 days'
  ),

  -- Gachibowli & Financial District (ZONE-HYD-02) - 3 Requests
  (
    '20000000-0000-0000-0000-000000000005',
    'Vikram Mehta',
    '+91-98490-99005',
    'Apt 12B, Aparna Sarovar, Nallagandla / Gachibowli, Hyderabad',
    '00000000-0000-0000-0000-000000000002',
    17.4530, 78.3280,
    CURRENT_DATE, '09:00 - 12:00',
    'pending', 'normal',
    'Defunct microwave and audio receiver',
    'QR-REQ-HYD-005', true, now() - INTERVAL '3 hours'
  ),
  (
    '20000000-0000-0000-0000-000000000006',
    'Ananya Sen',
    '+91-98491-12345',
    'Block C, Golf View Apartments, Gachibowli, Hyderabad',
    '00000000-0000-0000-0000-000000000002',
    17.4360, 78.3510,
    CURRENT_DATE, '14:00 - 17:00',
    'scheduled', 'normal',
    '3 broken LCD monitors from startup office',
    'QR-REQ-HYD-006', true, now() - INTERVAL '1 day'
  ),
  (
    '20000000-0000-0000-0000-000000000007',
    'Rohit Nair',
    '+91-98491-56789',
    'Sky Villa 5, Financial District, Nanakramguda, Hyderabad',
    '00000000-0000-0000-0000-000000000002',
    17.4190, 78.3420,
    CURRENT_DATE, '14:00 - 17:00',
    'assigned', 'urgent',
    'Server rack switches and UPS battery unit',
    'QR-REQ-HYD-007', true, now() - INTERVAL '5 hours'
  ),

  -- Jubilee Hills & Banjara Hills (ZONE-HYD-04 / 05) - 3 Requests
  (
    '20000000-0000-0000-0000-000000000008',
    'Divya Chandrasekhar',
    '+91-98492-23456',
    'Road No. 36, Jubilee Hills, Hyderabad',
    '00000000-0000-0000-0000-000000000004',
    17.4340, 78.4020,
    CURRENT_DATE + INTERVAL '1 day', '09:00 - 12:00',
    'pending', 'normal',
    'Vintage Sony Trinitron TV (heavy, ~25kg)',
    'QR-REQ-HYD-008', true, now() - INTERVAL '6 hours'
  ),
  (
    '20000000-0000-0000-0000-000000000009',
    'Mahesh Babu G.',
    '+91-98492-67890',
    'Road No. 12, Banjara Hills, Hyderabad',
    '00000000-0000-0000-0000-000000000005',
    17.4160, 78.4320,
    CURRENT_DATE, '09:00 - 12:00',
    'assigned', 'normal',
    'Broken iPads, MacBook Pro with damaged logic board',
    'QR-REQ-HYD-009', true, now() - INTERVAL '18 hours'
  ),
  (
    '20000000-0000-0000-0000-000000000010',
    'Fatima Begum',
    '+91-98493-34567',
    'Near City Center Mall, Banjara Hills, Hyderabad',
    '00000000-0000-0000-0000-000000000005',
    17.4210, 78.4480,
    CURRENT_DATE - INTERVAL '2 days', '14:00 - 17:00',
    'collected', 'normal',
    'Rotary landline phone, cassette decks, speakers',
    'QR-REQ-HYD-010', true, now() - INTERVAL '3 days'
  ),

  -- Kukatpally (ZONE-HYD-06) - 2 Requests
  (
    '20000000-0000-0000-0000-000000000011',
    'Srinivas Chary',
    '+91-98493-78901',
    'Phase 4, KPHB Colony, Kukatpally, Hyderabad',
    '00000000-0000-0000-0000-000000000006',
    17.4890, 78.3960,
    CURRENT_DATE, '09:00 - 12:00',
    'pending', 'normal',
    'Damaged water purifier control panel and inverter',
    'QR-REQ-HYD-011', true, now() - INTERVAL '8 hours'
  ),
  (
    '20000000-0000-0000-0000-000000000012',
    'Lavanya Joshi',
    '+91-98494-45678',
    'Near Forum Sujana Mall, Kukatpally, Hyderabad',
    '00000000-0000-0000-0000-000000000006',
    17.4820, 78.3880,
    CURRENT_DATE, '14:00 - 17:00',
    'scheduled', 'normal',
    'Computer peripherals, keyboards, mouse bundles',
    'QR-REQ-HYD-012', true, now() - INTERVAL '12 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. SEED SAMPLE COLLECTION RECORDS FOR COLLECTED DEMO REQUESTS
-- ------------------------------------------------------------------------------
INSERT INTO collection_records (
  id, request_id, actual_weight_kg, verified_at, verification_method, notes
) VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000004',
    4.2, now() - INTERVAL '1 day', 'qr_scan',
    'Verified via driver QR scanner; 6 small items collected in tote bag.'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000010',
    11.8, now() - INTERVAL '2 days', 'digital_scale',
    'Vintage audio hardware verified on vehicle digital scale.'
  )
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. SEED INITIAL EVENT LOG ENTRIES
-- ------------------------------------------------------------------------------
INSERT INTO event_log (event_type, entity_type, entity_id, actor_role, payload_json, created_at) VALUES
  (
    'REQUEST_CREATED',
    'collection_requests',
    '20000000-0000-0000-0000-000000000001',
    'CITIZEN',
    '{"address": "My Home Bhooja, HITEC City", "zone": "ZONE-HYD-01", "items_est": 3}'::jsonb,
    now() - INTERVAL '2 hours'
  ),
  (
    'REQUEST_CREATED',
    'collection_requests',
    '20000000-0000-0000-0000-000000000007',
    'CITIZEN',
    '{"address": "Financial District", "priority": "urgent"}'::jsonb,
    now() - INTERVAL '5 hours'
  ),
  (
    'PICKUP_ASSIGNED',
    'collection_requests',
    '20000000-0000-0000-0000-000000000007',
    'DISPATCHER',
    '{"vehicle_code": "EV-VAN-01", "slot": "14:00 - 17:00"}'::jsonb,
    now() - INTERVAL '4 hours'
  ),
  (
    'ITEM_COLLECTED',
    'collection_requests',
    '20000000-0000-0000-0000-000000000004',
    'COLLECTOR',
    '{"qr_token": "QR-REQ-HYD-004", "actual_weight_kg": 4.2}'::jsonb,
    now() - INTERVAL '1 day'
  );
