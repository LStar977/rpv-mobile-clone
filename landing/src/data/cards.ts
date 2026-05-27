import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  MapPin,
  Vote,
  BarChart3,
  Link2,
  EyeOff,
  Users,
} from "lucide-react";

export interface CivicCard {
  id: number;
  title: string;
  label: string;
  meta: string;
  icon: LucideIcon;
}

export const cards: CivicCard[] = [
  {
    id: 1,
    title: "Verified Identity",
    label: "Verified Resident",
    meta: "Government ID matched",
    icon: BadgeCheck,
  },
  {
    id: 2,
    title: "Local Voice",
    label: "Local Proposal",
    meta: "District 4 · active",
    icon: MapPin,
  },
  {
    id: 3,
    title: "Geo-Gated Voting",
    label: "Secure Ballot",
    meta: "Location confirmed",
    icon: Vote,
  },
  {
    id: 4,
    title: "Transparent Results",
    label: "Transparent Results",
    meta: "Live tally · public",
    icon: BarChart3,
  },
  {
    id: 5,
    title: "Blockchain Audit Trail",
    label: "Audit Confirmed",
    meta: "Block #482,119",
    icon: Link2,
  },
  {
    id: 6,
    title: "Anonymous Ballots",
    label: "Secure Ballot",
    meta: "Zero-knowledge",
    icon: EyeOff,
  },
  {
    id: 7,
    title: "Public Consensus",
    label: "Public Consensus",
    meta: "78% aligned",
    icon: Users,
  },
];
