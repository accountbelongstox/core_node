enum UserRoleType {
  developer,
  client,
  architect,
  reviewer,
  admin,
}

// Developer sub-types
enum DeveloperType {
  regular,      // Regular developer
  architect,    // Architect
}

// Client sub-types
enum ClientType {
  individual,   // Individual
  enterprise,   // Enterprise
}

enum UserRoleStatus {
  pending,
  approved,
  active,
  suspended,
  rejected,
}

enum VerificationStatus {
  notStarted,
  pending,
  approved,
  rejected,
}

enum EmailVerificationStatus {
  unverified,
  verified,
  expired,
}

enum PhoneVerificationStatus {
  unverified,
  verified,
}

enum IdentityType {
  idCard,
  passport,
  drivingLicense,
}

enum ProjectStatus {
  draft,
  open,
  inProgress,
  paused,
  completed,
  cancelled,
  archived,
}

enum ProjectBudgetRange {
  under5k,
  range5k10k,
  range10k50k,
  range50k100k,
  over100k,
}

enum ProjectComplexity {
  simple,
  medium,
  complex,
  veryComplex,
}

enum MilestoneStatus {
  pending,
  inProgress,
  completed,
  failed,
  cancelled,
}

enum TaskStatus {
  open,
  assigned,
  inProgress,
  submitted,
  underReview,
  approved,
  rejected,
  completed,
  cancelled,
}

enum TaskPriority {
  low,
  medium,
  high,
  urgent,
}

enum TaskCommentType {
  general,
  codeReview,
  question,
  suggestion,
}

enum PaymentMethod {
  alipay,
  wechat,
  bankTransfer,
  creditCard,
  wallet,
}

enum PaymentStatus {
  pending,
  processing,
  completed,
  failed,
  cancelled,
  refunded,
}

enum PaymentType {
  deposit,
  projectPayment,
  milestonePayment,
  refund,
  withdrawal,
  bonus,
}

enum TransactionStatus {
  pending,
  completed,
  failed,
  cancelled,
}

enum WalletTransactionType {
  deposit,
  withdrawal,
  projectEarning,
  bonus,
  penalty,
  refund,
}

enum CodeQualityScore {
  poor,
  fair,
  good,
  veryGood,
  excellent,
}

enum ReviewStatus {
  pending,
  inReview,
  completed,
  disputed,
}

enum SkillLevel {
  beginner,
  intermediate,
  advanced,
  expert,
}

enum CertificationStatus {
  pending,
  verified,
  expired,
  rejected,
}

enum NotificationType {
  projectInvitation,
  taskAssigned,
  paymentReceived,
  submissionApproved,
  submissionRejected,
  message,
  system,
}

enum NotificationStatus {
  unread,
  read,
  archived,
}

// Developer levels (based on points and completed projects)
enum DeveloperLevel {
  level1,    // Newbie (0-100 points)
  level2,    // Junior (101-500 points)
  level3,    // Intermediate (501-1500 points)
  level4,    // Senior (1501-3000 points)
  level5,    // Expert (3001-5000 points)
  level6,    // Master (5001+ points)
}

// Client levels (based on projects posted and payment amount)
enum ClientLevel {
  level1,    // New (0-5 projects)
  level2,    // Bronze (6-15 projects)
  level3,    // Silver (16-30 projects)
  level4,    // Gold (31-50 projects)
  level5,    // Platinum (51-100 projects)
  level6,    // Diamond (100+ projects)
}

enum Industry {
  saas,
  ecommerce,
  fintech,
  healthcare,
  education,
  enterprise,
  mobile,
  iot,
  aiMl,
  other,
}

enum ProgrammingLanguage {
  javascript,
  typescript,
  python,
  java,
  php,
  csharp,
  golang,
  rust,
  ruby,
  cpp,
  kotlin,
  swift,
}

enum Framework {
  react,
  vue,
  angular,
  svelte,
  laravel,
  django,
  express,
  spring,
  dotnet,
  gin,
  fastapi,
  nextjs,
  nuxt,
  remix,
}

enum Database {
  mysql,
  postgresql,
  mongodb,
  redis,
  elasticsearch,
  dynamodb,
  firestore,
  cassandra,
  mariadb,
}

// Attachment types
enum AttachmentType {
  projectDocument,
  taskDocument,
  proposalDocument,
  submissionDocument,
  verificationDocument,
  other,
}

// File types
enum AttachmentFileType {
  pdf,
  doc,
  docx,
  xls,
  xlsx,
  ppt,
  pptx,
  txt,
  zip,
  rar,
  image,
}

// Certification types
enum CertificationType {
  education,        // Educational certificate
  professional,     // Professional certification
  skill,           // Skill certification
  project,         // Project completion certificate
  award,           // Award or recognition
}

// Budget types
enum BudgetType {
  fixed,           // Fixed price
  hourly,          // Hourly rate
  milestone,       // Milestone-based
}

// Project complexity types (detailed)
enum ProjectComplexityType {
  simple,
  medium,
  complex,
  veryComplex,
}

// Project status types (detailed)
enum ProjectStatusType {
  draft,
  open,
  inProgress,
  paused,
  completed,
  cancelled,
  archived,
}

class CodeMartConstants {
  static const Map<UserRoleType, double> defaultDepositAmounts = {
    UserRoleType.developer: 199.00,
    UserRoleType.client: 0.00,
    UserRoleType.architect: 999.00,
  };

  static const int defaultPage = 1;
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;

  static const int maxFileSizeMb = 10;
  static const int imageMaxSizeMb = 5;
  static const List<String> supportedImages = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  static const List<String> supportedDocuments = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];

  static const int otpLength = 6;
  static const int otpExpiryMinutes = 10;
  static const int otpMaxAttempts = 5;
  static const int otpResendCooldownSeconds = 60;

  static const int emailTokenLength = 64;
  static const int emailExpiryHours = 24;

  static const double minBudget = 100;
  static const double maxBudget = 1000000;
  static const int minDurationDays = 1;
  static const int maxDurationDays = 365;

  static const int ratingMin = 1;
  static const int ratingMax = 5;
  static const int ratingPrecision = 2;
}
