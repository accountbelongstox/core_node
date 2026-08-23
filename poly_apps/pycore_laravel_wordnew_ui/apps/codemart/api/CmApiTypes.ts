export interface CmPublicMetricData {
  total_amount: string | null;
  currency: string | null;
  project_count: number | null;
  developer_count: number | null;
}

export interface CmPublicTestimonialData {
  id: string;
  quote: string;
  author_label: string;
  role_label: string;
  avatar_url: string | null;
}

export interface CmPublicHomeData extends CmPublicMetricData {
  testimonials: CmPublicTestimonialData[];
}

export interface CmPublicHomeLoadResult {
  data: CmPublicHomeData | null;
  errorCode: string | null;
}
