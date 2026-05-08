import { type FounderIntake } from "./schemas";

export const founderPresets: Array<{ label: string; blurb: string; value: FounderIntake }> = [
  {
    label: "Lehi SaaS Operator",
    blurb: "First-time B2B founder looking for customer discovery and community.",
    value: {
      founderProfileId: "0a5b3b1d-f770-457f-962f-d0eef5dcf101",
      locationCity: "Lehi",
      locationLat: 40.3916,
      locationLng: -111.8508,
      idea: "AI workflow copilot for service businesses with repetitive quoting and scheduling work.",
      industry: "saas",
      stage: "validation",
      challenge: "I am stuck on early distribution and need better founder feedback loops.",
      fundingStatus: "bootstrapped",
      background: "Product operator with marketplace and field operations experience.",
      category: "community",
      cityFilter: "Lehi",
      topN: 4
    }
  },
  {
    label: "Provo Deeptech Builder",
    blurb: "University-adjacent founder trying to move from prototype to pilots.",
    value: {
      founderProfileId: "8eb5875e-018a-4818-b397-cb576cf7bf11",
      locationCity: "Provo",
      locationLat: 40.2338,
      locationLng: -111.6585,
      idea: "Computer-vision system that helps local manufacturers reduce downtime.",
      industry: "industrial ai",
      stage: "mvp",
      challenge: "Need design partners, pilot customers, and a tighter fundraising story.",
      fundingStatus: "friends and family",
      background: "Technical founder with robotics research and consulting experience.",
      category: "university",
      cityFilter: "Provo",
      topN: 4
    }
  }
];
