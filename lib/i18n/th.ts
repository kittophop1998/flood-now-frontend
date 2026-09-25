import type { TranslationKey } from "./en";

export const th: Record<TranslationKey, string> = {
  retry: "ลองใหม่",
  loadingReports: "กำลังโหลดรายงาน…",
  locationUnavailable: "ไม่พบตำแหน่งของคุณ — แสดงพื้นที่เริ่มต้นแทน คุณยังรายงานและดูแผนที่ได้ตามปกติ",

  reportButton: "รายงาน",
  dragPinHint: "ลากแผนที่เพื่อวางหมุด",
  cancel: "ยกเลิก",
  myLocation: "ตำแหน่งของฉัน",
  useThisSpot: "ใช้ตำแหน่งนี้",
  newReportTitle: "รายงานใหม่",
  reportDetailTitle: "รายละเอียดรายงาน",

  helpNotDispatchNotice: "นี่คือคำขอความช่วยเหลือจากชุมชน ไม่ใช่การแจ้งหน่วยกู้ภัยอย่างเป็นทางการ",
  reportPhotoAlt: "รูปภาพรายงาน",
  waterLevelLabel: "ระดับน้ำ:",
  cmUnit: "ซม.",
  personCountOne: "{n} คน",
  personCountOther: "{n} คน",
  childPresent: "มีเด็ก",
  elderlyPresent: "มีผู้สูงอายุ",
  stillAccurateQuestion: "ข้อมูลนี้ยังถูกต้องอยู่ไหม?",
  stillActive: "ยังคงเกิดอยู่",
  cleared: "คลี่คลายแล้ว",
  confirmationSummary: "ยืนยันว่ายังเกิดอยู่ {stillActive} ครั้ง · ยืนยันว่าคลี่คลายแล้ว {cleared} ครั้ง",

  expiredPrefix: "หมดอายุ · ",
  lastVerifiedPrefix: "ยืนยันล่าสุด ",
  justNow: "เมื่อสักครู่",
  minutesAgo: "{n} นาทีที่แล้ว",
  hoursAgo: "{n} ชั่วโมงที่แล้ว",
  daysAgo: "{n} วันที่แล้ว",

  change: "แก้ไข",
  typeLabel: "ประเภท",
  typePlaceholder: "เกิดอะไรขึ้น?",
  severityLabel: "ความรุนแรง",
  severityPlaceholder: "รุนแรงแค่ไหน?",
  waterLevelFieldLabel: "ระดับน้ำ (ซม.)",
  descriptionLabel: "รายละเอียด (ไม่บังคับ)",
  descriptionPlaceholder: "ข้อมูลเพิ่มเติมที่ควรรู้",
  helpNeededNotice:
    "รายงานขอความช่วยเหลือจะแสดงให้ผู้ใช้ใกล้เคียงเห็นว่าเร่งด่วน — แอปนี้ไม่ได้แจ้งหน่วยกู้ภัยอย่างเป็นทางการ",
  peopleCountLabel: "จำนวนคน",
  contactPhoneLabel: "เบอร์ติดต่อ (ไม่บังคับ)",
  photoLabel: "รูปภาพ",
  submitting: "กำลังส่ง…",
  submitReport: "ส่งรายงาน",

  chooseReportType: "เลือกประเภทรายงาน",
  chooseSeverity: "เลือกความรุนแรง",
  imageTypeError: "รองรับเฉพาะไฟล์ภาพ JPEG, PNG หรือ WEBP เท่านั้น",
  imageSizeError: "ไฟล์ภาพต้องมีขนาดเล็กกว่า 8 MB",

  removePhoto: "ลบรูปภาพ",
  addPhoto: "เพิ่มรูปภาพ (ไม่บังคับ)",

  reportAriaLabel: "รายงาน{type}",

  "reportType.flooded": "น้ำท่วม",
  "reportType.road_blocked": "ถนนถูกปิดกั้น",
  "reportType.vehicle_stalled": "รถเสียขวางทาง",
  "reportType.help_needed": "ต้องการความช่วยเหลือ",

  "severity.passable": "ผ่านได้",
  "severity.caution": "ระมัดระวัง",
  "severity.small_vehicle_not_recommended": "รถเล็ก: ควรเลี่ยง",
  "severity.impassable": "ผ่านไม่ได้",

  failedLoadReports: "โหลดรายงานไม่สำเร็จ",
  failedCreateReport: "สร้างรายงานไม่สำเร็จ",
  failedConfirmReport: "ยืนยันรายงานไม่สำเร็จ",
};
