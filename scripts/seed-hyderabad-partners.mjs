import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Read .env.local or .env.production.local
function getEnv() {
  const env = {};
  const envFiles = ['.env.production.local', '.env.local'];
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...vals] = trimmed.split('=');
          env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }
  return env;
}

const env = getEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials.');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

const HYDERABAD_PARTNERS = [
  // Repair (4)
  {
    name: 'Deccan Silicon & Logic Board Clinic',
    partner_type: 'repair',
    lat: 17.4486,
    lng: 78.3908,
    city: 'Hyderabad',
    contact: '+91-98490-12844 | support@deccansilicon.in',
    verified: true,
  },
  {
    name: 'CyberTowers MicroFix Lab',
    partner_type: 'repair',
    lat: 17.4504,
    lng: 78.3809,
    city: 'Hyderabad',
    contact: '+91-98851-77210 | intake@cybertowersfix.com',
    verified: true,
  },
  {
    name: 'Nizam Chipset & Hardware Restorations',
    partner_type: 'repair',
    lat: 17.4399,
    lng: 78.4983,
    city: 'Hyderabad',
    contact: '+91-99081-33245 | desk@nizamrestorations.org',
    verified: true,
  },
  {
    name: 'Kukatpally Device Care & Soldering Center',
    partner_type: 'repair',
    lat: 17.4938,
    lng: 78.3995,
    city: 'Hyderabad',
    contact: '+91-97011-88432 | kphb.care@gadgetclinic.in',
    verified: true,
  },

  // Refurbisher (4)
  {
    name: 'Charminar Circular Systems',
    partner_type: 'refurbisher',
    lat: 17.4401,
    lng: 78.3489,
    city: 'Hyderabad',
    contact: '+91-98480-44911 | sales@charminarcircular.in',
    verified: true,
  },
  {
    name: 'HITEC Revive Hardware Labs',
    partner_type: 'refurbisher',
    lat: 17.4699,
    lng: 78.3578,
    city: 'Hyderabad',
    contact: '+91-99499-12340 | intake@hitecrevive.org',
    verified: true,
  },
  {
    name: 'Kakatiya Tech Refurb Hub',
    partner_type: 'refurbisher',
    lat: 17.4375,
    lng: 78.4482,
    city: 'Hyderabad',
    contact: '+91-98660-55789 | ops@kakatiyarefurb.com',
    verified: true,
  },
  {
    name: 'Golconda Electronics Rebuilders',
    partner_type: 'refurbisher',
    lat: 17.4447,
    lng: 78.4664,
    city: 'Hyderabad',
    contact: '+91-97033-66120 | refurb@golcondarebuilders.in',
    verified: true,
  },

  // NGO (4)
  {
    name: 'Telangana Digital Inclusion Trust',
    partner_type: 'ngo',
    lat: 17.4156,
    lng: 78.4357,
    city: 'Hyderabad',
    contact: '+91-94400-88120 | donate@telanganadigitaltrust.org',
    verified: true,
  },
  {
    name: 'Hyderabad VidyaTech Community Network',
    partner_type: 'ngo',
    lat: 17.4319,
    lng: 78.4073,
    city: 'Hyderabad',
    contact: '+91-98491-33200 | contact@vidyatechhyd.org',
    verified: true,
  },
  {
    name: 'Deccan Green Bridge Foundation',
    partner_type: 'ngo',
    lat: 17.3871,
    lng: 78.4792,
    city: 'Hyderabad',
    contact: '+91-99890-77112 | outreach@deccangreenbridge.org',
    verified: true,
  },
  {
    name: 'Samarthya Hyderabad Sustainable Tech Hub',
    partner_type: 'ngo',
    lat: 17.3916,
    lng: 78.4398,
    city: 'Hyderabad',
    contact: '+91-98666-44331 | donate@samarthyahyd.org',
    verified: true,
  },

  // Recycler (4)
  {
    name: 'Cherlapally Eco-Recovery & Smelting',
    partner_type: 'recycler',
    lat: 17.4623,
    lng: 78.6012,
    city: 'Hyderabad',
    contact: '+91-98495-66778 | plant@cherlapallyrecovery.co.in',
    verified: true,
  },
  {
    name: 'Deccan Zero-Waste Material Processors',
    partner_type: 'recycler',
    lat: 17.5186,
    lng: 78.4522,
    city: 'Hyderabad',
    contact: '+91-99480-22119 | ops@deccanzero.in',
    verified: true,
  },
  {
    name: 'PearlCity Urban Minerals & E-Waste Refiners',
    partner_type: 'recycler',
    lat: 17.4674,
    lng: 78.4412,
    city: 'Hyderabad',
    contact: '+91-98661-88900 | dispatch@pearlcityminerals.com',
    verified: true,
  },
  {
    name: 'Telangana GreenSpire Industrial Recovery Facility',
    partner_type: 'recycler',
    lat: 17.4042,
    lng: 78.5606,
    city: 'Hyderabad',
    contact: '+91-97010-33445 | intake@greenspiretelangana.org',
    verified: true,
  },

  // Informal (4)
  {
    name: 'Yadagiri Verified Scrap Aggregation Point',
    partner_type: 'informal',
    lat: 17.4428,
    lng: 78.3842,
    city: 'Hyderabad',
    contact: '+91-98481-99023 | via RE:LOOP Hyderabad WhatsApp Dispatch',
    verified: true,
  },
  {
    name: 'Khaleel Bhai Verified Electronics Kabadiwala',
    partner_type: 'informal',
    lat: 17.3616,
    lng: 78.4747,
    city: 'Hyderabad',
    contact: '+91-98850-66124 | via RE:LOOP South Zone Coordinator',
    verified: true,
  },
  {
    name: 'Cyberabad Green Scrap Sorters',
    partner_type: 'informal',
    lat: 17.4968,
    lng: 78.3546,
    city: 'Hyderabad',
    contact: '+91-99088-22310 | via RE:LOOP Logistics Desk',
    verified: true,
  },
  {
    name: 'Secunderabad EcoCollector Verified Node',
    partner_type: 'informal',
    lat: 17.4412,
    lng: 78.4891,
    city: 'Hyderabad',
    contact: '+91-97001-44567 | via RE:LOOP Field Operator',
    verified: true,
  },
];

async function run() {
  console.log('Target database:', supabaseUrl);
  console.log('Inserting 20 Hyderabad partners into Supabase...');

  for (const partner of HYDERABAD_PARTNERS) {
    const { data: existing } = await client
      .from('partners')
      .select('id')
      .eq('name', partner.name)
      .maybeSingle();

    if (!existing) {
      const { error } = await client.from('partners').insert(partner);
      if (error) {
        console.error(`Failed to insert ${partner.name}:`, error.message);
      } else {
        console.log(`✓ Inserted: ${partner.name}`);
      }
    } else {
      console.log(`Already in DB: ${partner.name}`);
    }
  }

  const { count, error } = await client
    .from('partners')
    .select('*', { count: 'exact', head: true });

  if (error) console.error('Count error:', error.message);
  else console.log(`Total partners in Supabase: ${count}`);
}

run();
