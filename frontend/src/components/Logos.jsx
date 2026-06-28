/** Official logo wrappers using react-icons/si (SimpleIcons brand SVGs). */
import React from "react";
import {
  SiAmazon, SiGooglecloud, SiOracle, SiCloudflare,
  SiOpenai, SiAnthropic, SiGooglegemini, SiMeta,
  SiKubernetes,
} from "react-icons/si";
import { VscAzure } from "react-icons/vsc";
import { Cube } from "@phosphor-icons/react";

// Official brand colors
const BRAND = {
  aws: "#FF9900",
  gcp: "#4285F4",
  azure: "#0078D4",
  oracle: "#F80000",
  cloudflare: "#F38020",
  "on-prem": "#A1A1AA",
  openai: "#FFFFFF",
  anthropic: "#D4A27F",
  gemini: "#4796E3",
  meta: "#0866FF",
  llama: "#0866FF",
  groq: "#F55036",
};

const CLOUD_ICON = {
  aws: SiAmazon,
  gcp: SiGooglecloud,
  azure: VscAzure,
  oracle: SiOracle,
  cloudflare: SiCloudflare,
  "on-prem": SiKubernetes,
};

const PROVIDER_ICON = {
  openai: SiOpenai,
  anthropic: SiAnthropic,
  gemini: SiGooglegemini,
  meta: SiMeta,
  llama: SiMeta,
  groq: SiGroq,
};

export function CloudLogo({ id, size = 24, mono = false }) {
  const Icon = CLOUD_ICON[id] || Cube;
  const color = mono ? "currentColor" : (BRAND[id] || "#A1A1AA");
  return <Icon size={size} color={color} data-testid={`cloud-logo-${id}`} />;
}

export function ProviderLogo({ id, size = 24, mono = false }) {
  const Icon = PROVIDER_ICON[id] || Cube;
  const color = mono ? "currentColor" : (BRAND[id] || "#A1A1AA");
  return <Icon size={size} color={color} data-testid={`provider-logo-${id}`} />;
}

export const CLOUD_LABEL = {
  aws: "AWS",
  gcp: "Google Cloud",
  azure: "Azure",
  oracle: "Oracle Cloud",
  cloudflare: "Cloudflare",
  "on-prem": "On-Prem",
};
