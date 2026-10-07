-- ==============================================================================
-- RE:LOOP Partner Seed Data (Hyderabad & Bengaluru, India)
-- 40 Verified Partners across 5 Categories (Repair, Refurbisher, NGO, Recycler, Informal)
-- ==============================================================================

INSERT INTO partners (name, partner_type, lat, lng, city, contact, verified) VALUES
  -- ============================================================================
  -- HYDERABAD PARTNERS (20 Verified Nodes)
  -- ============================================================================

  -- ----------------------------------------------------------------------------
  -- REPAIR PARTNERS (4)
  -- ----------------------------------------------------------------------------
  (
    'Deccan Silicon & Logic Board Clinic',
    'repair',
    17.4486,
    78.3908,
    'Hyderabad',
    '+91-98490-12844 | support@deccansilicon.in',
    true
  ),
  (
    'CyberTowers MicroFix Lab',
    'repair',
    17.4504,
    78.3809,
    'Hyderabad',
    '+91-98851-77210 | intake@cybertowersfix.com',
    true
  ),
  (
    'Nizam Chipset & Hardware Restorations',
    'repair',
    17.4399,
    78.4983,
    'Hyderabad',
    '+91-99081-33245 | desk@nizamrestorations.org',
    true
  ),
  (
    'Kukatpally Device Care & Soldering Center',
    'repair',
    17.4938,
    78.3995,
    'Hyderabad',
    '+91-97011-88432 | kphb.care@gadgetclinic.in',
    true
  ),

  -- ----------------------------------------------------------------------------
  -- REFURBISHER PARTNERS (4)
  -- ----------------------------------------------------------------------------
  (
    'Charminar Circular Systems',
    'refurbisher',
    17.4401,
    78.3489,
    'Hyderabad',
    '+91-98480-44911 | sales@charminarcircular.in',
    true
  ),
  (
    'HITEC Revive Hardware Labs',
    'refurbisher',
    17.4699,
    78.3578,
    'Hyderabad',
    '+91-99499-12340 | intake@hitecrevive.org',
    true
  ),
  (
    'Kakatiya Tech Refurb Hub',
    'refurbisher',
    17.4375,
    78.4482,
    'Hyderabad',
    '+91-98660-55789 | ops@kakatiyarefurb.com',
    true
  ),
  (
    'Golconda Electronics Rebuilders',
    'refurbisher',
    17.4447,
    78.4664,
    'Hyderabad',
    '+91-97033-66120 | refurb@golcondarebuilders.in',
    true
  ),

  -- ----------------------------------------------------------------------------
  -- NGO & DONATION PARTNERS (4)
  -- ----------------------------------------------------------------------------
  (
    'Telangana Digital Inclusion Trust',
    'ngo',
    17.4156,
    78.4357,
    'Hyderabad',
    '+91-94400-88120 | donate@telanganadigitaltrust.org',
    true
  ),
  (
    'Hyderabad VidyaTech Community Network',
    'ngo',
    17.4319,
    78.4073,
    'Hyderabad',
    '+91-98491-33200 | contact@vidyatechhyd.org',
    true
  ),
  (
    'Deccan Green Bridge Foundation',
    'ngo',
    17.3871,
    78.4792,
    'Hyderabad',
    '+91-99890-77112 | outreach@deccangreenbridge.org',
    true
  ),
  (
    'Samarthya Hyderabad Sustainable Tech Hub',
    'ngo',
    17.3916,
    78.4398,
    'Hyderabad',
    '+91-98666-44331 | donate@samarthyahyd.org',
    true
  ),

  -- ----------------------------------------------------------------------------
  -- RECYCLER PARTNERS (4)
  -- ----------------------------------------------------------------------------
  (
    'Cherlapally Eco-Recovery & Smelting',
    'recycler',
    17.4623,
    78.6012,
    'Hyderabad',
    '+91-98495-66778 | plant@cherlapallyrecovery.co.in',
    true
  ),
  (
    'Deccan Zero-Waste Material Processors',
    'recycler',
    17.5186,
    78.4522,
    'Hyderabad',
    '+91-99480-22119 | ops@deccanzero.in',
    true
  ),
  (
    'PearlCity Urban Minerals & E-Waste Refiners',
    'recycler',
    17.4674,
    78.4412,
    'Hyderabad',
    '+91-98661-88900 | dispatch@pearlcityminerals.com',
    true
  ),
  (
    'Telangana GreenSpire Industrial Recovery Facility',
    'recycler',
    17.4042,
    78.5606,
    'Hyderabad',
    '+91-97010-33445 | intake@greenspiretelangana.org',
    true
  ),

  -- ----------------------------------------------------------------------------
  -- INFORMAL (VERIFIED COMMUNITY COLLECTORS) (4)
  -- ----------------------------------------------------------------------------
  (
    'Yadagiri Verified Scrap Aggregation Point',
    'informal',
    17.4428,
    78.3842,
    'Hyderabad',
    '+91-98481-99023 | via RE:LOOP Hyderabad WhatsApp Dispatch',
    true
  ),
  (
    'Khaleel Bhai Verified Electronics Kabadiwala',
    'informal',
    17.3616,
    78.4747,
    'Hyderabad',
    '+91-98850-66124 | via RE:LOOP South Zone Coordinator',
    true
  ),
  (
    'Cyberabad Green Scrap Sorters',
    'informal',
    17.4968,
    78.3546,
    'Hyderabad',
    '+91-99088-22310 | via RE:LOOP Logistics Desk',
    true
  ),
  (
    'Secunderabad EcoCollector Verified Node',
    'informal',
    17.4412,
    78.4891,
    'Hyderabad',
    '+91-97001-44567 | via RE:LOOP Field Operator',
    true
  ),

  -- ============================================================================
  -- BENGALURU PARTNERS (20 Verified Nodes)
  -- ============================================================================

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
