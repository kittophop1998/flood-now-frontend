export const en = {
  retry: "Retry",
  loadingReports: "Loading reports…",
  locationUnavailable: "Location unavailable — showing a default area. You can still report and browse.",

  reportButton: "Report",
  dragPinHint: "Drag the map to place your pin",
  cancel: "Cancel",
  myLocation: "My location",
  useThisSpot: "Use this spot",
  newReportTitle: "New report",
  reportDetailTitle: "Report detail",

  helpNotDispatchNotice: "This is a community help request, not a dispatched emergency service.",
  reportPhotoAlt: "Report photo",
  waterLevelLabel: "Water level:",
  cmUnit: "cm",
  personCountOne: "{n} person",
  personCountOther: "{n} people",
  childPresent: "Child present",
  elderlyPresent: "Elderly present",
  stillAccurateQuestion: "Is this still accurate?",
  stillActive: "Still active",
  cleared: "Cleared",
  confirmationSummary: "{stillActive} confirmed still active · {cleared} confirmed cleared",

  expiredPrefix: "Expired · ",
  lastVerifiedPrefix: "Last verified ",
  justNow: "just now",
  minutesAgo: "{n}m ago",
  hoursAgo: "{n}h ago",
  daysAgo: "{n}d ago",

  change: "Change",
  typeLabel: "Type",
  typePlaceholder: "What's happening?",
  severityLabel: "Severity",
  severityPlaceholder: "How bad is it?",
  waterLevelFieldLabel: "Water level (cm)",
  descriptionLabel: "Description (optional)",
  descriptionPlaceholder: "Anything else people should know",
  helpNeededNotice:
    "Help-needed reports are shown to nearby users as urgent — this app does not dispatch official rescue services.",
  peopleCountLabel: "People count",
  contactPhoneLabel: "Contact phone (optional)",
  photoLabel: "Photo",
  submitting: "Submitting…",
  submitReport: "Submit report",

  chooseReportType: "Choose a report type",
  chooseSeverity: "Choose a severity",
  imageTypeError: "Only JPEG, PNG, or WEBP images are supported.",
  imageSizeError: "Image must be smaller than 8 MB.",

  removePhoto: "Remove photo",
  addPhoto: "Add a photo (optional)",

  reportAriaLabel: "{type} report",

  "reportType.flooded": "Flooded",
  "reportType.road_blocked": "Road blocked",
  "reportType.vehicle_stalled": "Vehicle stalled",
  "reportType.help_needed": "Help needed",

  "severity.passable": "Passable",
  "severity.caution": "Caution",
  "severity.small_vehicle_not_recommended": "Small vehicles: avoid",
  "severity.impassable": "Impassable",

  failedLoadReports: "Failed to load reports.",
  failedCreateReport: "Failed to create report.",
  failedConfirmReport: "Failed to confirm report.",
} as const;

export type TranslationKey = keyof typeof en;
