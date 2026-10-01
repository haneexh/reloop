-- ==============================================================================
-- RE:LOOP Partner Seed Data (Bengaluru, India)
-- 20 Verified Partners across 5 Categories (Repair, Refurbisher, NGO, Recycler, Informal)
-- ==============================================================================

INSERT INTO partners (name, partner_type, lat, lng, city, contact, verified) VALUES
  -- ----------------------------------------------------------------------------
  -- REPAIR PARTNERS (4)
  -- ----------------------------------------------------------------------------
  (
    'FixCraft MicroElectronics Lab',
    'repair',
    12.9784,
    77.6408,
    'Bengaluru',
    '+91-98450-12831 | fixcraft.indiranagar@example.com',
    true
  ),
  (
    'Precision Chipset & Motherboard Clinic',
    'repair',
    12.9352,
    77.6245,
    'Bengaluru',
    '+91-98801-44720 | support@precisionclinic-blr.in',
    true
  ),
  (
    'Urban Gadget Fixworks',
    'repair',
    12.9121,
    77.6446,
    'Bengaluru',
    '+91-97312-88190 | desk@urbangadgetfix.com',
    true
  ),
  (
    'Apex Appliance & Device Restoration',
    'repair',
    12.9308,
    77.5838,
    'Bengaluru',
    '+91-99002-31567 | care@apexdevicehub.org',
    true
  ),

  -- ----------------------------------------------------------------------------
  -- REFURBISHER PARTNERS (4)
  -- ----------------------------------------------------------------------------
  (
    'NextCycle Systems & Laptops',
    'refurbisher',
    12.9698,
    77.7499,
    'Bengaluru',
    '+91-98442-99011 | intake@nextcyclesystems.in',
    true
  ),
  (
    'ReNew Silicon Refurb Hub',
    'refurbisher',
    12.8452,
    77.6602,
    'Bengaluru',
    '+91-96860-77123 | operations@renewsilicon.com',
    true
  ),
  (
    'CirculaTech Hardware Rebuilders',
    'refurbisher',
    12.9591,
    77.6974,
    'Bengaluru',
    '+91-99805-66234 | contact@circulatech.in',
    true
  ),
  (
    'Vanguard IT Revive Center',
    'refurbisher',
    12.9166,
    77.6101,
    'Bengaluru',
    '+91-98863-12098 | hello@vanguardrevive.org',
    true
  ),

  -- ----------------------------------------------------------------------------
  -- NGO & DONATION PARTNERS (4)
  -- ----------------------------------------------------------------------------
  (
    'Seva Bridge Digital Inclusion Trust',
    'ngo',
    12.9422,
    77.5753,
    'Bengaluru',
    '+91-94480-55120 | donate@sevabridge.org',
    true
  ),
  (
    'GreenHorizon Community Foundation',
    'ngo',
    13.0031,
    77.5703,
    'Bengaluru',
    '+91-98451-22440 | circular@greenhorizonblr.org',
    true
  ),
  (
    'VidyaTech Hardware Donation Network',
    'ngo',
    13.0358,
    77.5970,
    'Bengaluru',
    '+91-99019-33882 | access@vidyatechindia.org',
    true
  ),
  (
    'Samarthya Sustainable Living Collective',
    'ngo',
    12.9982,
    77.5530,
    'Bengaluru',
    '+91-97400-88129 | outreach@samarthya-trust.org',
    true
  ),

  -- ----------------------------------------------------------------------------
  -- RECYCLER PARTNERS (4)
  -- ----------------------------------------------------------------------------
  (
    'EcoMetallix E-Waste Processors',
    'recycler',
    13.0285,
    77.5197,
    'Bengaluru',
    '+91-98459-77001 | dispatch@ecometallix.co.in',
    true
  ),
  (
    'TerraZero Circular Recycling Facility',
    'recycler',
    12.8164,
    77.6834,
    'Bengaluru',
    '+91-99800-44912 | recovery@terrazero-blr.in',
    true
  ),
  (
    'CleanGrid Materials Recovery Plant',
    'recycler',
    13.0978,
    77.3912,
    'Bengaluru',
    '+91-97399-55670 | log@cleangridwaste.com',
    true
  ),
  (
    'GreenSpire Urban Smelting & E-Recovery',
    'recycler',
    12.8904,
    77.6415,
    'Bengaluru',
    '+91-98867-88901 | plant@greenspirerecovery.org',
    true
  ),

  -- ----------------------------------------------------------------------------
  -- INFORMAL (VERIFIED COMMUNITY COLLECTORS) (4)
  -- ----------------------------------------------------------------------------
  (
    'Ramesh Kabadiwala Verified Collection Point',
    'informal',
    12.9857,
    77.6057,
    'Bengaluru',
    '+91-98440-11239 | via RE:LOOP Hub WhatsApp Dispatch',
    true
  ),
  (
    'Syed & Sons Verified Scrap Sorters',
    'informal',
    12.9972,
    77.6134,
    'Bengaluru',
    '+91-97411-88902 | via RE:LOOP Hub SMS Desk',
    true
  ),
  (
    'Babu Bhai Verified Electronics Aggregator',
    'informal',
    12.9654,
    77.5768,
    'Bengaluru',
    '+91-99008-34190 | via RE:LOOP Field Operator',
    true
  ),
  (
    'Anand EcoScrap Verified Node',
    'informal',
    13.0224,
    77.5492,
    'Bengaluru',
    '+91-98809-66120 | via RE:LOOP Logistics Coordinator',
    true
  );
