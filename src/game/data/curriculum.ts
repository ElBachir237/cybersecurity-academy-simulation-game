// ============================================================
// HORIZON CYBER ACADEMY — Curriculum, skills, chapters, badges
// The full career roadmap exists from day one. Chapters unlock
// progressively; the player can SEE a track without playing it.
// ============================================================

export interface TrackDef {
  id: string;
  label: { fr: string; en: string };
  color: string; // tailwind-safe accent
}

export const TRACKS: TrackDef[] = [
  { id: "foundation", label: { fr: "Fondamentaux", en: "Foundations" }, color: "#38bdf8" },
  { id: "network", label: { fr: "Réseau", en: "Network" }, color: "#34d399" },
  { id: "systems", label: { fr: "Systèmes", en: "Systems" }, color: "#a78bfa" },
  { id: "security", label: { fr: "Sécurité", en: "Security" }, color: "#f472b6" },
  { id: "soc", label: { fr: "SOC", en: "SOC" }, color: "#fbbf24" },
  { id: "web", label: { fr: "Web", en: "Web" }, color: "#22d3ee" },
  { id: "offensive", label: { fr: "Offensif", en: "Offensive" }, color: "#fb7185" },
  { id: "dfir", label: { fr: "DFIR", en: "DFIR" }, color: "#c084fc" },
  { id: "identity", label: { fr: "Identité", en: "Identity" }, color: "#60a5fa" },
  { id: "cloud", label: { fr: "Cloud", en: "Cloud" }, color: "#2dd4bf" },
  { id: "devsecops", label: { fr: "DevSecOps", en: "DevSecOps" }, color: "#f97316" },
  { id: "malware", label: { fr: "Malware", en: "Malware" }, color: "#f87171" },
  { id: "threatintel", label: { fr: "Threat Intel", en: "Threat Intel" }, color: "#e879f9" },
  { id: "crypto", label: { fr: "Cryptographie", en: "Cryptography" }, color: "#818cf8" },
  { id: "architecture", label: { fr: "Architecture", en: "Architecture" }, color: "#4ade80" },
  { id: "grc", label: { fr: "GRC", en: "GRC" }, color: "#facc15" },
  { id: "purple", label: { fr: "Purple Team", en: "Purple Team" }, color: "#c084fc" },
];

export interface SkillDef {
  id: string;
  label: { fr: string; en: string };
  track: string;
  prereq: string[];
}

export const SKILLS: SkillDef[] = [
  // Foundation
  { id: "computer_basics", label: { fr: "Ordinateur & OS", en: "Computer & OS" }, track: "foundation", prereq: [] },
  { id: "terminal", label: { fr: "Terminal", en: "Terminal" }, track: "foundation", prereq: ["computer_basics"] },
  { id: "internet_basics", label: { fr: "Internet & TCP/IP", en: "Internet & TCP/IP" }, track: "foundation", prereq: ["computer_basics"] },
  // Network
  { id: "ipv4", label: { fr: "Adressage IPv4", en: "IPv4 addressing" }, track: "network", prereq: ["internet_basics"] },
  { id: "subnetting", label: { fr: "Sous-réseaux / CIDR", en: "Subnetting / CIDR" }, track: "network", prereq: ["ipv4"] },
  { id: "dns", label: { fr: "DNS", en: "DNS" }, track: "network", prereq: ["ipv4"] },
  { id: "dhcp", label: { fr: "DHCP", en: "DHCP" }, track: "network", prereq: ["ipv4"] },
  { id: "routing", label: { fr: "Routage", en: "Routing" }, track: "network", prereq: ["ipv4"] },
  { id: "switching", label: { fr: "Commutation", en: "Switching" }, track: "network", prereq: ["ipv4"] },
  { id: "vlan", label: { fr: "VLAN", en: "VLAN" }, track: "network", prereq: ["switching"] },
  { id: "firewall", label: { fr: "Firewall", en: "Firewall" }, track: "network", prereq: ["routing"] },
  { id: "wifi", label: { fr: "Wi-Fi", en: "Wi-Fi" }, track: "network", prereq: ["network_basics"] },
  { id: "network_basics", label: { fr: "Bases réseau", en: "Network basics" }, track: "network", prereq: ["internet_basics"] },
  { id: "network_diag", label: { fr: "Diagnostic réseau", en: "Network diagnostics" }, track: "network", prereq: ["dns", "dhcp"] },
  // Systems
  { id: "linux_admin", label: { fr: "Administration Linux", en: "Linux administration" }, track: "systems", prereq: ["terminal"] },
  { id: "windows_admin", label: { fr: "Administration Windows", en: "Windows administration" }, track: "systems", prereq: ["computer_basics"] },
  { id: "services", label: { fr: "Services & logs", en: "Services & logs" }, track: "systems", prereq: ["linux_admin"] },
  // Security
  { id: "sec_fundamentals", label: { fr: "Fondamentaux sécurité", en: "Security fundamentals" }, track: "security", prereq: [] },
  { id: "defense_depth", label: { fr: "Defense in Depth", en: "Defense in Depth" }, track: "security", prereq: ["sec_fundamentals"] },
  { id: "zero_trust", label: { fr: "Zero Trust", en: "Zero Trust" }, track: "security", prereq: ["defense_depth"] },
  // SOC
  { id: "alert_triage", label: { fr: "Alert Triage", en: "Alert triage" }, track: "soc", prereq: ["sec_fundamentals"] },
  { id: "log_analysis", label: { fr: "Analyse de logs", en: "Log analysis" }, track: "soc", prereq: ["services", "alert_triage"] },
  { id: "siem", label: { fr: "SIEM", en: "SIEM" }, track: "soc", prereq: ["log_analysis"] },
  { id: "incident_response", label: { fr: "Réponse à incident", en: "Incident response" }, track: "soc", prereq: ["alert_triage"] },
  { id: "threat_hunting", label: { fr: "Threat Hunting", en: "Threat hunting" }, track: "soc", prereq: ["siem"] },
  // Web
  { id: "http", label: { fr: "HTTP", en: "HTTP" }, track: "web", prereq: ["internet_basics"] },
  { id: "auth", label: { fr: "Authentification", en: "Authentication" }, track: "web", prereq: ["http"] },
  { id: "api_security", label: { fr: "Sécurité des API", en: "API security" }, track: "web", prereq: ["auth"] },
  { id: "web_security", label: { fr: "Sécurité Web", en: "Web security" }, track: "web", prereq: ["http"] },
  // DFIR
  { id: "forensics", label: { fr: "Forensics", en: "Forensics" }, track: "dfir", prereq: ["log_analysis"] },
  { id: "timeline", label: { fr: "Timeline & reconstruction", en: "Timeline & reconstruction" }, track: "dfir", prereq: ["forensics"] },
  // Identity
  { id: "active_directory", label: { fr: "Active Directory", en: "Active Directory" }, track: "identity", prereq: ["windows_admin"] },
  { id: "iam", label: { fr: "IAM", en: "IAM" }, track: "identity", prereq: ["sec_fundamentals"] },
  // Cloud
  { id: "cloud_iam", label: { fr: "Cloud IAM", en: "Cloud IAM" }, track: "cloud", prereq: ["iam"] },
  { id: "cloud_network", label: { fr: "Réseau cloud", en: "Cloud network" }, track: "cloud", prereq: ["routing", "cloud_iam"] },
  { id: "cloud_ir", label: { fr: "Réponse à incident cloud", en: "Cloud IR" }, track: "cloud", prereq: ["incident_response", "cloud_network"] },
  // DevSecOps
  { id: "git", label: { fr: "Git & CI/CD", en: "Git & CI/CD" }, track: "devsecops", prereq: ["terminal"] },
  { id: "sast", label: { fr: "SAST & dépendances", en: "SAST & dependencies" }, track: "devsecops", prereq: ["git"] },
  { id: "containers", label: { fr: "Conteneurs", en: "Containers" }, track: "devsecops", prereq: ["git"] },
  // Malware
  { id: "malware_triage", label: { fr: "Triage de malware", en: "Malware triage" }, track: "malware", prereq: ["forensics"] },
  { id: "ioc", label: { fr: "IOC", en: "IOC" }, track: "malware", prereq: ["malware_triage"] },
  // Threat intel
  { id: "osint", label: { fr: "OSINT", en: "OSINT" }, track: "threatintel", prereq: ["sec_fundamentals"] },
  { id: "ttp", label: { fr: "TTP & MITRE", en: "TTP & MITRE" }, track: "threatintel", prereq: ["osint"] },
  // Crypto
  { id: "hashing", label: { fr: "Hachage", en: "Hashing" }, track: "crypto", prereq: [] },
  { id: "encryption", label: { fr: "Chiffrement", en: "Encryption" }, track: "crypto", prereq: ["hashing"] },
  { id: "pki", label: { fr: "PKI & certificats", en: "PKI & certificates" }, track: "crypto", prereq: ["encryption"] },
  // Architecture / GRC / Purple
  { id: "seg_arch", label: { fr: "Segmentation & architecture", en: "Segmentation & architecture" }, track: "architecture", prereq: ["firewall", "vlan"] },
  { id: "risk", label: { fr: "Risque & gouvernance", en: "Risk & governance" }, track: "grc", prereq: ["sec_fundamentals"] },
  { id: "audit", label: { fr: "Audit & conformité", en: "Audit & compliance" }, track: "grc", prereq: ["risk"] },
  { id: "purple_team", label: { fr: "Purple Team", en: "Purple team" }, track: "purple", prereq: ["incident_response", "ioc"] },
];

export interface ChapterDef {
  id: number;
  titleKey: string;
  subKey?: string;
  status: "released" | "partial" | "soon";
  theoryKeys: string[]; // keys into dict.theory
  missionIds: string[];
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    titleKey: "First Day",
    status: "released",
    theoryKeys: ["c1_intro", "c1_net", "c1_dns", "c1_dhcp"],
    missionIds: ["c1_lab", "c1_mission", "c1_sim"],
  },
  {
    id: 2,
    titleKey: "chapter2",
    subKey: "chapter2",
    status: "released",
    theoryKeys: ["c2_ip", "c2_subnet", "c2_plan"],
    missionIds: ["c2_lab", "c2_mission", "c2_sim"],
  },
  {
    id: 3,
    titleKey: "chapter3",
    subKey: "chapter3",
    status: "released",
    theoryKeys: ["c3_seg", "c3_fw", "c3_blast", "c3_port", "c3_nat"],
    missionIds: ["c3_lab", "c3_port", "c3_nat", "c3_mission", "c3_sim"],
  },
  {
    id: 4,
    titleKey: "chapter4",
    subKey: "chapter4",
    status: "released",
    theoryKeys: ["c4_win", "c4_wifi", "c4_desk"],
    missionIds: ["c4_lab", "c4_wifi", "c4_desk", "c4_sim"],
  },
  { id: 5, titleKey: "Systèmes & AD", status: "soon", theoryKeys: [], missionIds: [] },
  { id: 6, titleKey: "Admin réseau", status: "soon", theoryKeys: [], missionIds: [] },
  { id: 7, titleKey: "SOC L1", status: "soon", theoryKeys: [], missionIds: [] },
  { id: 8, titleKey: "SOC L2", status: "soon", theoryKeys: [], missionIds: [] },
  { id: 9, titleKey: "Incident Response", status: "soon", theoryKeys: [], missionIds: [] },
  { id: 10, titleKey: "DFIR", status: "soon", theoryKeys: [], missionIds: [] },
];

export interface BadgeDef {
  id: string;
  icon: string; // lucide icon key mapped in UI
  nameKey: string;
  descKey: string;
}

export const BADGES: BadgeDef[] = [
  { id: "curious", icon: "compass", nameKey: "badges.curious.name", descKey: "badges.curious.desc" },
  { id: "first_network", icon: "network", nameKey: "badges.first_network.name", descKey: "badges.first_network.desc" },
  { id: "dns_detective", icon: "search", nameKey: "badges.dns_detective.name", descKey: "badges.dns_detective.desc" },
  { id: "log_hunter", icon: "scroll", nameKey: "badges.log_hunter.name", descKey: "badges.log_hunter.desc" },
  { id: "incident_responder", icon: "shield", nameKey: "badges.incident_responder.name", descKey: "badges.incident_responder.desc" },
  { id: "methodical", icon: "target", nameKey: "badges.methodical.name", descKey: "badges.methodical.desc" },
  { id: "firewall_architect", icon: "brick", nameKey: "badges.firewall_architect.name", descKey: "badges.firewall_architect.desc" },
  { id: "subnet_planner", icon: "layers", nameKey: "badges.subnet_planner.name", descKey: "badges.subnet_planner.desc" },
];

export interface TitleDef {
  id: string;
  nameKey: string;
  minXp: number;
  skills: string[]; // skill ids that must be >= practice
}

export const TITLES: TitleDef[] = [
  { id: "intern", nameKey: "titles.intern", minXp: 0, skills: [] },
  { id: "junior_tech", nameKey: "titles.junior_tech", minXp: 150, skills: ["network_diag"] },
  { id: "tech", nameKey: "titles.tech", minXp: 400, skills: ["network_diag", "linux_admin"] },
  { id: "junior_analyst", nameKey: "titles.junior_analyst", minXp: 700, skills: ["alert_triage"] },
  { id: "analyst", nameKey: "titles.analyst", minXp: 1100, skills: ["siem", "log_analysis"] },
  { id: "sec_engineer", nameKey: "titles.sec_engineer", minXp: 1600, skills: ["firewall", "seg_arch"] },
  { id: "incident_responder", nameKey: "titles.incident_responder", minXp: 2200, skills: ["incident_response", "forensics"] },
  { id: "specialist", nameKey: "titles.specialist", minXp: 3000, skills: ["incident_response", "cloud_ir"] },
  { id: "senior", nameKey: "titles.senior", minXp: 4200, skills: ["threat_hunting", "ttp"] },
  { id: "expert", nameKey: "titles.expert", minXp: 6000, skills: ["purple_team", "audit"] },
  { id: "master", nameKey: "titles.master", minXp: 9000, skills: ["purple_team", "ttp", "cloud_ir"] },
];

export interface CertDef {
  id: string;
  titleKey: string;
  level: string;
  missionIds: string[];
  skills: string[];
}

export const CERTIFICATES: CertDef[] = [
  {
    id: "cyber_explorer",
    titleKey: "Cyber Explorer",
    level: "Chapter 1",
    missionIds: ["c1_lab", "c1_mission", "c1_sim"],
    skills: ["network_basics", "dns", "dhcp", "network_diag", "terminal"],
  },
  {
    id: "net_foundations",
    titleKey: "Network Foundations",
    level: "Chapter 2",
    missionIds: ["c2_lab", "c2_mission", "c2_sim"],
    skills: ["ipv4", "subnetting", "routing", "network_diag"],
  },
  {
    id: "net_sentinel",
    titleKey: "Network Sentinel",
    level: "Chapter 3",
    missionIds: ["c3_lab", "c3_port", "c3_nat", "c3_mission", "c3_sim"],
    skills: ["firewall", "vlan", "switching", "seg_arch", "defense_depth"],
  },
  {
    id: "svc_desk",
    titleKey: "Service Desk Associate",
    level: "Chapter 4",
    missionIds: ["c4_lab", "c4_wifi", "c4_desk", "c4_sim"],
    skills: ["windows_admin", "wifi", "computer_basics", "network_diag"],
  },
];

export const SKILL_LEVEL_ORDER = [
  "discovery",
  "learning",
  "practice",
  "competent",
  "proficient",
  "mastered",
] as const;

export function levelIndex(level: string): number {
  return SKILL_LEVEL_ORDER.indexOf(level as (typeof SKILL_LEVEL_ORDER)[number]);
}

export function computeTitle(
  xp: number,
  skills: Record<string, { level: string }>
): string {
  let best = TITLES[0];
  const practiceOk = (id: string) =>
    !!skills[id] && levelIndex(skills[id].level) >= levelIndex("practice");
  for (const t of TITLES) {
    if (xp >= t.minXp && t.skills.every(practiceOk)) best = t;
  }
  return best.id;
}
