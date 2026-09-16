export type ContactSource =
  | 'facebook'
  | 'phone'
  | 'walk_in'
  | 'referral'
  | 'google'
  | 'other';

export type JobStatus =
  | 'lost'
  | 'quoted'
  | 'awaiting_dropoff'
  | 'in_shop'
  | 'in_progress'
  | 'complete_awaiting_pickup'
  | 'paid_closed';

export type PaymentMethod = 'cash' | 'check' | 'card' | 'other';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'check', 'card', 'other'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  check: 'Check',
  card: 'Card',
  other: 'Other',
};

export type JobCategory =
  | 'canvas_tent'
  | 'upholstery_seats'
  | 'awning'
  | 'pack_bag_repair'
  | 'custom_build'
  | 'leather'
  | 'other';

export const JOB_CATEGORIES: JobCategory[] = [
  'canvas_tent',
  'upholstery_seats',
  'awning',
  'pack_bag_repair',
  'custom_build',
  'leather',
  'other',
];

export const JOB_CATEGORY_LABELS: Record<JobCategory, string> = {
  canvas_tent: 'Canvas Tent',
  upholstery_seats: 'Upholstery / Seats',
  awning: 'Awning',
  pack_bag_repair: 'Pack / Bag Repair',
  custom_build: 'Custom Build',
  leather: 'Leather',
  other: 'Other',
};

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  contact_source: ContactSource;
  contact_handle: string | null;
  notes: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  customer_id: string;
  item_description: string;
  status: JobStatus;
  date_received: string | null;
  date_promised: string | null;
  date_completed: string | null;
  date_paid: string | null;
  quote_amount: number | null;
  actual_charged: number | null;
  materials_cost: number | null;
  hours_worked: number | null;
  notes: string | null;
  needs_followup: boolean;
  followup_by: string | null;
  review_requested: boolean;
  review_requested_at: string | null;
  payment_method: PaymentMethod | null;
  category: JobCategory | null;
  created_at: string;
  updated_at: string;
}

export type PhotoCategory = 'intake' | 'in_progress' | 'finished' | 'other';

export interface JobPhoto {
  id: string;
  job_id: string;
  photo_url: string;
  storage_path: string | null;
  caption: string | null;
  category: PhotoCategory;
  created_at: string;
}

export const PHOTO_CATEGORIES: PhotoCategory[] = [
  'intake',
  'in_progress',
  'finished',
  'other',
];

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  intake: 'Intake',
  in_progress: 'In Progress',
  finished: 'Finished',
  other: 'Other',
};

export type JobWithCustomer = Job & { customer: Customer };

export const JOB_STATUS_ORDER: JobStatus[] = [
  'lost',
  'quoted',
  'awaiting_dropoff',
  'in_shop',
  'in_progress',
  'complete_awaiting_pickup',
  'paid_closed',
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  lost: 'Lost',
  quoted: 'Quoted',
  awaiting_dropoff: 'Awaiting Drop-off',
  in_shop: 'In Shop',
  in_progress: 'In Progress',
  complete_awaiting_pickup: 'Complete / Pickup',
  paid_closed: 'Paid / Closed',
};

export const CONTACT_SOURCES: ContactSource[] = [
  'facebook',
  'phone',
  'walk_in',
  'referral',
  'google',
  'other',
];

export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  facebook: 'Facebook',
  phone: 'Phone',
  walk_in: 'Walk-in',
  referral: 'Referral',
  google: 'Google',
  other: 'Other',
};

export type PortfolioStatus = 'draft' | 'published';

export const PORTFOLIO_STATUSES: PortfolioStatus[] = ['draft', 'published'];
export const PORTFOLIO_STATUS_LABELS: Record<PortfolioStatus, string> = {
  draft: 'Draft',
  published: 'Published',
};

export interface PortfolioItem {
  id: string;
  title: string;
  category: JobCategory | null;
  description: string;
  materials_techniques: string[];
  approach: string | null;
  challenge: string | null;
  detail_1_label: string | null;
  detail_1_value: string | null;
  detail_2_label: string | null;
  detail_2_value: string | null;
  detail_3_label: string | null;
  detail_3_value: string | null;
  before_image_url: string | null;
  after_image_url: string | null;
  before_storage_path: string | null;
  after_storage_path: string | null;
  display_order: number;
  status: PortfolioStatus;
  created_at: string;
  updated_at: string;
}

export const COMMON_PORTFOLIO_TAGS = [
  'Canvas',
  'Heavy Vinyl',
  'Cordura',
  'Webbing',
  'Walking Foot Machine',
  'Hand-Stitched',
  'Machine-Stitched',
  'UV Thread',
  'Leather',
  'Wool Felt',
  'Grommets',
  'Zipper Replacement',
];

// ── Mail-in repair requests ────────────────────────────────────────────
// Backed by public.repair_requests / public.repair_photos, which are fed by
// the public intake form. Column checks live in the DB; the unions below
// mirror them exactly — keep them in sync or inserts will 400.

export type RepairStatus =
  | 'new'
  | 'contacted'
  | 'quoted'
  | 'approved'
  | 'in_shop'
  | 'shipped_back'
  | 'closed'
  | 'declined';

export const REPAIR_STATUS_ORDER: RepairStatus[] = [
  'new',
  'contacted',
  'quoted',
  'approved',
  'in_shop',
  'shipped_back',
  'closed',
  'declined',
];

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  approved: 'Approved',
  in_shop: 'In Shop',
  shipped_back: 'Shipped Back',
  closed: 'Closed',
  declined: 'Declined',
};

/** Tailwind classes for the status pill, warm → cool as the job progresses. */
export const REPAIR_STATUS_TONES: Record<RepairStatus, string> = {
  new: 'bg-rust-100 text-rust-800',
  contacted: 'bg-amber-100 text-amber-800',
  quoted: 'bg-sky-100 text-sky-800',
  approved: 'bg-indigo-100 text-indigo-800',
  in_shop: 'bg-brand-100 text-brand-800',
  shipped_back: 'bg-brand-200 text-brand-900',
  closed: 'bg-slate-200 text-slate-700',
  declined: 'bg-slate-100 text-slate-500',
};

export type RepairCategory = 'tent' | 'shade' | 'seat' | 'other';

export const REPAIR_CATEGORIES: RepairCategory[] = ['tent', 'shade', 'seat', 'other'];

export const REPAIR_CATEGORY_LABELS: Record<RepairCategory, string> = {
  tent: 'Tent',
  shade: 'Shade',
  seat: 'Seat',
  other: 'Other',
};

export type IfUnrepairable = 'return' | 'dispose';

export const IF_UNREPAIRABLE_OPTIONS: IfUnrepairable[] = ['return', 'dispose'];

export const IF_UNREPAIRABLE_LABELS: Record<IfUnrepairable, string> = {
  return: 'Ship it back',
  dispose: 'Dispose of it',
};

export type RepairContactMethod = 'phone' | 'email';

export const REPAIR_CONTACT_METHODS: RepairContactMethod[] = ['phone', 'email'];

export const REPAIR_CONTACT_METHOD_LABELS: Record<RepairContactMethod, string> = {
  phone: 'Phone',
  email: 'Email',
};

export type EstimateSource = 'table' | 'easypost' | 'shippo';

export const ESTIMATE_SOURCES: EstimateSource[] = ['table', 'easypost', 'shippo'];

export const ESTIMATE_SOURCE_LABELS: Record<EstimateSource, string> = {
  table: 'Rate table',
  easypost: 'EasyPost',
  shippo: 'Shippo',
};

/** repair_photos.slot — one photo per slot per request (DB unique constraint). */
export type RepairPhotoSlot = 'full' | 'damage' | 'tag';

export const REPAIR_PHOTO_SLOTS: RepairPhotoSlot[] = ['full', 'damage', 'tag'];

export const REPAIR_PHOTO_SLOT_LABELS: Record<RepairPhotoSlot, string> = {
  full: 'Full Item',
  damage: 'Damage Close-up',
  tag: 'Care Tag',
};

export const COMMON_DAMAGE_TYPES = [
  'Tear',
  'Hole',
  'Seam Failure',
  'Zipper',
  'Broken Buckle',
  'Water Damage',
  'UV Degradation',
  'Mildew',
  'Abrasion',
  'Missing Hardware',
];

export interface RepairRequest {
  id: string;
  request_number: string;
  created_at: string;
  status: RepairStatus;
  category: RepairCategory | null;
  item_details: Record<string, unknown> | null;
  damage_types: string[] | null;
  damage_notes: string | null;
  replacement_value: number | null;
  spend_ceiling: number | null;
  if_unrepairable: IfUnrepairable | null;
  clean_dry_confirmed: boolean | null;
  ship_zip: string | null;
  ship_residential: boolean | null;
  box_length: number | null;
  box_width: number | null;
  box_height: number | null;
  box_weight: number | null;
  billable_weight: number | null;
  repair_estimate_low: number | null;
  repair_estimate_high: number | null;
  shipping_estimate_low: number | null;
  shipping_estimate_high: number | null;
  estimate_source: EstimateSource | null;
  timing_preference: string | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  contact_method: RepairContactMethod | null;
  contact_best_time: string | null;
  referral_source: string | null;
  referral_detail: string | null;
  raw_payload: Record<string, unknown>;
  internal_notes: string | null;
  client_submission_id: string | null;
}

export interface RepairPhoto {
  id: string;
  request_id: string;
  slot: RepairPhotoSlot;
  storage_path: string;
  created_at: string;
}
