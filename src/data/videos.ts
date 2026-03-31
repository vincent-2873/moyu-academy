export interface TrainingVideo {
  id: string;
  title: string;
  description: string;
  driveFileId: string;
  type: "video" | "slides";
  size: string;
  /** Which brands can see this video. Empty = all brands */
  brands: string[];
  /** Related module day numbers */
  relatedDays: number[];
  category: string;
  presenter?: string;
}

export interface VideoCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Brand filter: empty = all brands */
  brands: string[];
}

export const videoCategories: VideoCategory[] = [
  {
    id: "onboarding",
    title: "入職必看",
    description: "後台操作、公司組織介紹",
    icon: "🏢",
    brands: [],
  },
  {
    id: "xuemi-demo",
    title: "學米 DEMO 範例",
    description: "XUEMI 學米品牌 DEMO 流程與實戰錄影",
    icon: "🎬",
    brands: ["xuemi"],
  },
  {
    id: "ooschool-demo",
    title: "無限 DEMO 範例",
    description: "OOschool 無限學院 DEMO 流程與實戰錄影",
    icon: "🎬",
    brands: ["ooschool"],
  },
];

export const trainingVideos: TrainingVideo[] = [
  // === 入職必看 ===
  {
    id: "v-backend-tutorial",
    title: "後台操作教學",
    description: "完整的系統後台操作教學，新人必看",
    driveFileId: "1kn-z8VXrTFhc0J5mPTlSj6IhtUBovT2r",
    type: "video",
    size: "441.3 MB",
    brands: [],
    relatedDays: [1],
    category: "onboarding",
  },
  {
    id: "v-company-org",
    title: "公司組織說明",
    description: "墨宇集團組織架構與各部門介紹",
    driveFileId: "1mFY5_pCtsuvDV0KiO2Ferh0SCJIflsZx",
    type: "video",
    size: "81.8 MB",
    brands: [],
    relatedDays: [1],
    category: "onboarding",
  },

  // === 學米 DEMO ===
  {
    id: "v-xuemi-slides",
    title: "職能共學平台 (學米)",
    description: "學米品牌簡報資料",
    driveFileId: "1dVzWE1W8KdDZsWfdGYApIJs2Yn-YXCsPfvE3hBbJhOE",
    type: "slides",
    size: "2.8 MB",
    brands: ["xuemi"],
    relatedDays: [8],
    category: "xuemi-demo",
  },
  {
    id: "v-xuemi-flow",
    title: "學米 DEMO 流程示範",
    description: "標準學米 DEMO 流程完整示範",
    driveFileId: "1K6EPCzIz9wxjze15_3Tl3s-Lp226UVKh",
    type: "video",
    size: "194.3 MB",
    brands: ["xuemi"],
    relatedDays: [8],
    category: "xuemi-demo",
  },
  {
    id: "v-xuemi-jiyingning",
    title: "嵇映甯 DEMO",
    description: "嵇映甯的實戰 DEMO 錄影",
    driveFileId: "1wYq0ycCDY_wvruMVEyr05Ttd2jY1eUGR",
    type: "video",
    size: "422.2 MB",
    brands: ["xuemi"],
    relatedDays: [8],
    category: "xuemi-demo",
    presenter: "嵇映甯",
  },
  {
    id: "v-xuemi-linxichang",
    title: "林錫昌 DEMO",
    description: "林錫昌的實戰 DEMO 錄影",
    driveFileId: "1K4zHCwxguc3sHMKLwfciWHsh6tywrkvX",
    type: "video",
    size: "751.3 MB",
    brands: ["xuemi"],
    relatedDays: [8],
    category: "xuemi-demo",
    presenter: "林錫昌",
  },
  {
    id: "v-xuemi-linjialin",
    title: "林佳霖 DEMO",
    description: "林佳霖的實戰 DEMO 錄影",
    driveFileId: "1zFn5BjV5eJJEibwnZk3zwFtzEUoab619",
    type: "video",
    size: "792.6 MB",
    brands: ["xuemi"],
    relatedDays: [8],
    category: "xuemi-demo",
    presenter: "林佳霖",
  },

  // === 無限 DEMO ===
  {
    id: "v-ooschool-slides",
    title: "職能共學平台 (無限) 2026",
    description: "無限學院品牌簡報資料",
    driveFileId: "1yoPQ3vb2kenzA9SWxUmGQFI2hCApVcDP-hAGyIXvMR4",
    type: "slides",
    size: "5 MB",
    brands: ["ooschool"],
    relatedDays: [8],
    category: "ooschool-demo",
  },
  {
    id: "v-ooschool-flow",
    title: "無限 DEMO 流程示範",
    description: "標準無限 DEMO 流程完整示範",
    driveFileId: "1ABlZjToGKz1FEzDpj7oRx3A3W23-i4zL",
    type: "video",
    size: "273.6 MB",
    brands: ["ooschool"],
    relatedDays: [8],
    category: "ooschool-demo",
  },
  {
    id: "v-ooschool-yangyuhao",
    title: "楊祤豪 DEMO",
    description: "楊祤豪的實戰 DEMO 錄影",
    driveFileId: "1CCwbb1arrWqhF0NieSZH01D-ujEHqsXI",
    type: "video",
    size: "521.4 MB",
    brands: ["ooschool"],
    relatedDays: [8],
    category: "ooschool-demo",
    presenter: "楊祤豪",
  },
  {
    id: "v-ooschool-chenjizhi",
    title: "陳紀志 DEMO",
    description: "陳紀志的實戰 DEMO 錄影",
    driveFileId: "1zo5VwssmVCjSAJPFbRrEpwKB9SrtGh14",
    type: "video",
    size: "1.11 GB",
    brands: ["ooschool"],
    relatedDays: [8],
    category: "ooschool-demo",
    presenter: "陳紀志",
  },
  {
    id: "v-ooschool-hongkaiwen",
    title: "洪楷雯 DEMO",
    description: "洪楷雯的實戰 DEMO 錄影",
    driveFileId: "1F51tnaY5bJUE1bs2iCxA-qmQcqiw-n5M",
    type: "video",
    size: "590.3 MB",
    brands: ["ooschool"],
    relatedDays: [8],
    category: "ooschool-demo",
    presenter: "洪楷雯",
  },
];

/** Get videos visible to a specific brand */
export function getVideosForBrand(brandId: string): TrainingVideo[] {
  return trainingVideos.filter(
    (v) => v.brands.length === 0 || v.brands.includes(brandId)
  );
}

/** Get videos for a specific module day */
export function getVideosForDay(day: number, brandId: string): TrainingVideo[] {
  return getVideosForBrand(brandId).filter((v) => v.relatedDays.includes(day));
}

/** Get categories visible to a specific brand */
export function getCategoriesForBrand(brandId: string): VideoCategory[] {
  return videoCategories.filter(
    (c) => c.brands.length === 0 || c.brands.includes(brandId)
  );
}

/** Build Google Drive embed URL */
export function getDriveEmbedUrl(fileId: string, type: "video" | "slides"): string {
  if (type === "slides") {
    return `https://docs.google.com/presentation/d/${fileId}/embed?start=false&loop=false&delayms=3000`;
  }
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/** Build Google Drive direct link */
export function getDriveLink(fileId: string, type: "video" | "slides"): string {
  if (type === "slides") {
    return `https://docs.google.com/presentation/d/${fileId}`;
  }
  return `https://drive.google.com/file/d/${fileId}/view`;
}
