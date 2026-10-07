import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeOsmWithFallbackPartners,
  type PartnerLocation,
  type PartnerType,
} from "../lib/partners-data.ts";
import { classifyOsmElement } from "../lib/osm-parser.ts";

test("mergeOsmWithFallbackPartners: category with >= 2 OSM results uses OSM as primary", () => {
  const osmList: PartnerLocation[] = [
    {
      id: "osm_node_1",
      name: "Live OSM Repair 1",
      partner_type: "repair",
      lat: 17.44,
      lng: 78.39,
      city: "Hyderabad",
      contact: "Tel: 123",
      verified: true,
      distanceKm: 2.5,
      isLiveOsm: true,
    },
    {
      id: "osm_node_2",
      name: "Live OSM Repair 2",
      partner_type: "repair",
      lat: 17.45,
      lng: 78.40,
      city: "Hyderabad",
      contact: "Tel: 456",
      verified: true,
      distanceKm: 3.1,
      isLiveOsm: true,
    },
  ];

  const fallbackList: PartnerLocation[] = [
    {
      id: "verified_1",
      name: "Verified Partner Repair",
      partner_type: "repair",
      lat: 17.46,
      lng: 78.41,
      city: "Hyderabad",
      contact: "Tel: 789",
      verified: true,
      distanceKm: 5.0,
      isLiveOsm: false,
    },
    {
      id: "verified_2",
      name: "Verified Partner Recycler",
      partner_type: "recycler",
      lat: 17.47,
      lng: 78.42,
      city: "Hyderabad",
      contact: "Tel: 000",
      verified: true,
      distanceKm: 6.0,
      isLiveOsm: false,
    },
  ];

  const result = mergeOsmWithFallbackPartners(osmList, fallbackList);

  assert.equal(result.liveOsmCount, 2);
  assert.ok(result.categoriesWithLiveOsm.includes("repair"));

  // repair should contain the 2 OSM locations
  const repairDestinations = result.merged.filter((p) => p.partner_type === "repair");
  assert.equal(repairDestinations.length, 2);
  assert.ok(repairDestinations.every((p) => p.isLiveOsm === true));

  // recycler had 0 OSM, so it must fall back to the verified partner
  const recyclerDestinations = result.merged.filter((p) => p.partner_type === "recycler");
  assert.equal(recyclerDestinations.length, 1);
  assert.equal(recyclerDestinations[0].name, "Verified Partner Recycler");
  assert.equal(recyclerDestinations[0].isLiveOsm, false);
});

test("mergeOsmWithFallbackPartners: category with 0 OSM results gracefully falls back to verified partners", () => {
  const osmList: PartnerLocation[] = [];
  const fallbackList: PartnerLocation[] = [
    {
      id: "v1",
      name: "Verified NGO",
      partner_type: "ngo",
      lat: 17.4,
      lng: 78.3,
      city: "Hyderabad",
      contact: null,
      verified: true,
      distanceKm: 1.0,
      isLiveOsm: false,
    },
    {
      id: "v2",
      name: "Verified Recycler",
      partner_type: "recycler",
      lat: 17.5,
      lng: 78.4,
      city: "Hyderabad",
      contact: null,
      verified: true,
      distanceKm: 2.0,
      isLiveOsm: false,
    },
  ];

  const result = mergeOsmWithFallbackPartners(osmList, fallbackList);
  assert.equal(result.liveOsmCount, 0);
  assert.equal(result.verifiedCount, 2);
  assert.equal(result.merged.length, 2);
  assert.ok(result.merged.every((p) => p.isLiveOsm === false));
});

test("mergeOsmWithFallbackPartners: preserves informal nodes from verified list", () => {
  const osmList: PartnerLocation[] = [
    {
      id: "osm_repair",
      name: "OSM Repair",
      partner_type: "repair",
      lat: 17.44,
      lng: 78.39,
      city: "Hyderabad",
      contact: null,
      verified: true,
      distanceKm: 1.2,
      isLiveOsm: true,
    },
    {
      id: "osm_repair_2",
      name: "OSM Repair 2",
      partner_type: "repair",
      lat: 17.44,
      lng: 78.39,
      city: "Hyderabad",
      contact: null,
      verified: true,
      distanceKm: 1.5,
      isLiveOsm: true,
    },
  ];

  const fallbackList: PartnerLocation[] = [
    {
      id: "inf_1",
      name: "Local Kabbadiwala Node",
      partner_type: "informal",
      lat: 17.43,
      lng: 78.38,
      city: "Hyderabad",
      contact: null,
      verified: true,
      distanceKm: 2.1,
      isLiveOsm: false,
    },
  ];

  const result = mergeOsmWithFallbackPartners(osmList, fallbackList);
  const informal = result.merged.find((p) => p.partner_type === "informal");
  assert.ok(informal);
  assert.equal(informal.name, "Local Kabbadiwala Node");
});

test("classifyOsmElement: rejects non-electronic mis-tagged businesses for repair", () => {
  // Nazaw Pumps and Borewell mis-tagged as craft=electronics_repair
  const borewell = classifyOsmElement(
    { craft: "electronics_repair" },
    "Nazaw Pumps and Borewell"
  );
  assert.equal(borewell, null);

  // Weilding shop mis-tagged as craft=electronics_repair
  const welding = classifyOsmElement(
    { craft: "electronics_repair" },
    "Weilding shop"
  );
  assert.equal(welding, null);

  // Laundry / dry cleaners / Jeeves mis-tagged as shop=electronics_repair
  const laundry = classifyOsmElement(
    { shop: "electronics_repair" },
    "Sparkle Laundry & Dry Cleaners"
  );
  assert.equal(laundry, null);

  const jeeves = classifyOsmElement(
    { craft: "electronics_repair" },
    "Jeeves"
  );
  assert.equal(jeeves, null);

  const pressing = classifyOsmElement(
    { craft: "electronics_repair" },
    "Quick Iron & Pressing Shop"
  );
  assert.equal(pressing, null);

  // Plumber mis-tagged
  const plumber = classifyOsmElement(
    { craft: "electronics_repair" },
    "City Plumber Services"
  );
  assert.equal(plumber, null);
});

test("classifyOsmElement: strictly requires electronics qualification for repair", () => {
  // Generic shop=repair without electronics qualifier must be rejected
  const genericRepair = classifyOsmElement(
    { shop: "repair" },
    "General Repair Service"
  );
  assert.equal(genericRepair, null);

  // Generic craft=repair without electronics qualifier must be rejected
  const genericCraft = classifyOsmElement(
    { craft: "repair" },
    "All-in-One Repair Shop"
  );
  assert.equal(genericCraft, null);

  // Legitimate electronics repair
  const legitRepair = classifyOsmElement(
    { shop: "electronics_repair" },
    "Deccan Logic Board Clinic"
  );
  assert.ok(legitRepair);
  assert.equal(legitRepair.partnerType, "repair");
  assert.equal(legitRepair.sanitizedName, "Deccan Logic Board Clinic");

  // Legitimate mobile repair with repair=yes
  const legitMobile = classifyOsmElement(
    { shop: "mobile_phone", repair: "yes" },
    "iFix Mobile Care"
  );
  assert.ok(legitMobile);
  assert.equal(legitMobile.partnerType, "repair");
});

test("classifyOsmElement: rejects food/green waste and paper recycling from e-waste", () => {
  // Food & green waste bin
  const compostBin = classifyOsmElement(
    {
      amenity: "recycling",
      "recycling:food_waste": "yes",
      "recycling:green_waste": "yes",
      "recycling:paper": "yes",
    },
    ""
  );
  assert.equal(compostBin, null);

  // Paper Mart (not e-waste)
  const paperMart = classifyOsmElement(
    { amenity: "recycling" },
    "Mahesh Waste Paper Mart"
  );
  assert.equal(paperMart, null);

  // Genuine e-waste recycling
  const ewaste = classifyOsmElement(
    {
      amenity: "recycling",
      "recycling:electrical_appliances": "yes",
    },
    "GreenTek E-Waste Solutions"
  );
  assert.ok(ewaste);
  assert.equal(ewaste.partnerType, "recycler");
});

test("classifyOsmElement: rejects clothes and non-electronic items in second-hand and charity", () => {
  // Clothes thrift shop
  const clothesThrift = classifyOsmElement(
    { shop: "second_hand", second_hand: "clothes" },
    "Vintage Wardrobe"
  );
  assert.equal(clothesThrift, null);

  // Animal charity
  const petCharity = classifyOsmElement(
    { shop: "charity" },
    "Happy Paws Animal Rescue"
  );
  assert.equal(petCharity, null);

  // Generic charity
  const donationCenter = classifyOsmElement(
    { shop: "charity" },
    "Goonj Community Drop-off Hub"
  );
  assert.ok(donationCenter);
  assert.equal(donationCenter.partnerType, "ngo");
});

