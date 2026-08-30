// These types describe the SHAPE of our data. They don't do
// anything by themselves — they just let TypeScript catch mistakes
// for us, like typing "reporter_nmae" instead of "reporter_name",
// BEFORE we ever run the code.

// This matches the "relationship" column's check constraint in
// schema.sql — TypeScript will now yell at us if we try to use any
// value that isn't one of these four exact strings.
export type Relationship = 'self' | 'relative' | 'neighbor' | 'other';

export type Urgency = 'critical' | 'high' | 'medium' | 'low';
export type Category = 'medical' | 'food' | 'shelter' | 'rescue';
export type RequestStatus = 'pending' | 'assigned' | 'en_route' | 'resolved';

// The full shape of one row in the sos_requests table.
// "?" after a field name means it's optional / might be missing
// (matches columns that are nullable in the database).
export interface SosRequest {
  id: string;
  // Optional now — the Quick SOS button submits neither. The full
  // Request Help form still fills these in; see allow-quick-sos.sql
  // for why the database allows both cases.
  reporter_name?: string;
  reporter_phone?: string;
  relationship: Relationship;
  latitude: number;
  longitude: number;
  landmark?: string;
  description: string;
  category?: Category;
  urgency?: Urgency;
  status: RequestStatus;
  assigned_responder_id?: string;
  assigned_responder_type?: 'volunteer' | 'ngo';
  created_at: string;
  updated_at: string;
}

// The shape of one row in volunteer_profiles, including the
// full_name/phone we duplicate there (see add-volunteer-contact-fields.sql).
export interface VolunteerProfile {
  id: string;
  full_name?: string;
  phone?: string;
  signup_type: 'individual' | 'group';
  member_count?: number;
  skills: string[];
  latitude?: number;
  longitude?: number;
  available: boolean;
  updated_at: string;
}

export type NgoStatus = 'pending_approval' | 'approved' | 'rejected';

// The shape of one row in the ngos table — matches the columns in
// schema.sql exactly.
export interface Ngo {
  id: string;
  org_name: string;
  registration_number?: string;
  area_of_operation?: string;
  resources_available?: string;
  latitude?: number;
  longitude?: number;
  status: NgoStatus;
  created_at: string;
}

// The shape of one row in ngo_area_assignments — an admin-created
// "this NGO covers this radius, focused on this category" record.
export interface NgoAreaAssignment {
  id: string;
  ngo_id: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  area_name?: string;
  category?: Category;
  urgency?: Urgency;
  created_at: string;
}

// The shape of data we send TO the database when someone submits
// the form — notice it's missing fields like "id" and "status",
// because the database fills those in automatically (see schema.sql
// "default" values).
export type NewSosRequest = Pick<
  SosRequest,
  'reporter_name' | 'reporter_phone' | 'relationship' | 'latitude' | 'longitude' | 'landmark' | 'description'
>;
