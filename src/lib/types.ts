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
  /** Set when the job came from a Facebook group (migration 013). */
  fb_group_id: string | null;
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

// ── Weekly planner ─────────────────────────────────────────────────────
// Backed by stitchworks_tasks / _recurring_tasks / _blocked_days.
// Weekday numbers are 0=Sunday..6=Saturday (JS getDay + Postgres dow),
// even though the board renders Mon-first.

export type TaskType = 'bench' | 'business' | 'content' | 'admin';

export const TASK_TYPES: TaskType[] = ['bench', 'business', 'content', 'admin'];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  bench: 'Bench',
  business: 'Business',
  content: 'Content',
  admin: 'Admin',
};

/** Card accent + chip colors, one hue per type. */
export const TASK_TYPE_TONES: Record<TaskType, { chip: string; bar: string }> = {
  bench:    { chip: 'bg-brand-100 text-brand-800', bar: 'bg-brand-500' },
  business: { chip: 'bg-sky-100 text-sky-800',     bar: 'bg-sky-500' },
  content:  { chip: 'bg-rust-100 text-rust-800',   bar: 'bg-rust-500' },
  admin:    { chip: 'bg-slate-200 text-slate-700', bar: 'bg-slate-400' },
};

export type TaskSource = 'manual' | 'auto' | 'recurring';

/** Identifies which automation rule created a task, for dedupe. */
export type AutoRule =
  | 'awaiting_dropoff_stale'
  | 'quote_followup'
  | 'pickup_reminder'
  | 'lost_reengage'
  // Outreach (migration 013). These carry fb_rotation / fb_group_id instead
  // of job_id, and dedupe through their own partial unique indexes.
  | 'fb_rotation'
  | 'fb_group_offday';

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  type: TaskType;
  scheduled_date: string; // YYYY-MM-DD
  estimated_minutes: number | null;
  completed_at: string | null;
  rollover_count: number;
  source: TaskSource;
  job_id: string | null;
  auto_rule: AutoRule | null;
  recurring_task_id: string | null;
  fb_rotation: 'A' | 'B' | null;
  fb_group_id: string | null;
  created_at: string;
}

/** Task joined to its job's customer name, for the linked-job line on a card. */
export type TaskWithJob = Task & {
  job: { id: string; item_description: string; customer: { name: string } | null } | null;
};

export interface RecurringTask {
  id: string;
  title: string;
  type: TaskType;
  weekday: number;
  estimated_minutes: number | null;
  active: boolean;
  created_at: string;
}

export interface BlockedDay {
  id: string;
  weekday: number | null;
  date: string | null;
  label: string;
  created_at: string;
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Weekly target for billable bench work, in hours. */
export const BENCH_HOURS_TARGET = 6;

/** A task rolled this many times is considered stuck. */
export const STUCK_ROLLOVER_THRESHOLD = 3;

// ── Facebook group outreach ────────────────────────────────────────────

export type FbRegion = 'ouray_montrose_san_miguel' | 'grand_junction' | 'other';

export const FB_REGIONS: FbRegion[] = [
  'ouray_montrose_san_miguel',
  'grand_junction',
  'other',
];

export const FB_REGION_LABELS: Record<FbRegion, string> = {
  ouray_montrose_san_miguel: 'Ouray / Montrose / San Miguel',
  grand_junction: 'Grand Junction',
  other: 'Other',
};

export type FbRotation = 'A' | 'B';
export const FB_ROTATIONS: FbRotation[] = ['A', 'B'];

/** Rotation A posts Monday, rotation B posts Thursday. */
export const ROTATION_WEEKDAY: Record<FbRotation, number> = { A: 1, B: 4 };

export type FbGroupStatus = 'active' | 'paused' | 'removed';
export const FB_GROUP_STATUSES: FbGroupStatus[] = ['active', 'paused', 'removed'];
export const FB_GROUP_STATUS_LABELS: Record<FbGroupStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  removed: 'Removed',
};

export type TemplateCategory = 'tent' | 'awning' | 'mail_in' | 'general';
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'tent',
  'awning',
  'mail_in',
  'general',
];
export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  tent: 'Tent',
  awning: 'Awning',
  mail_in: 'Mail-in',
  general: 'General',
};

/** Days-since-last-post above this is flagged on the Groups page. */
export const STALE_GROUP_DAYS = 14;

export interface FbGroup {
  id: string;
  name: string;
  url: string;
  region: FbRegion;
  allowed_weekdays: number[];
  max_posts_per_week: number | null;
  rotation: FbRotation;
  status: FbGroupStatus;
  rule_notes: string | null;
  created_at: string;
}

export interface FbGroupPost {
  id: string;
  group_id: string;
  posted_at: string;
  template_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface PostTemplate {
  id: string;
  name: string;
  body: string;
  category: TemplateCategory;
  active: boolean;
  created_at: string;
}

/** A group plus the derived numbers the Groups page ranks on. */
export interface FbGroupStats {
  group: FbGroup;
  lastPostedAt: string | null;
  daysSince: number | null;
  postsThisWeek: number;
  jobsSourced: number;
  revenueSourced: number;
}
