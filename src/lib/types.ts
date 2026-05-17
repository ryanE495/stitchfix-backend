export type ContactSource =
  | 'facebook'
  | 'phone'
  | 'walk_in'
  | 'referral'
  | 'google'
  | 'other';

export type JobStatus =
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
  'quoted',
  'awaiting_dropoff',
  'in_shop',
  'in_progress',
  'complete_awaiting_pickup',
  'paid_closed',
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
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
