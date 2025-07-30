import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BharatX - AI-powered Crypto Search Engine",
    short_name: "BharatX",
    description: "BharatX is an AI-powered crypto search engine that helps you find information on the internet using advanced AI models like GPT-4, Claude, and Grok",
    start_url: "/",
    display: "standalone",
    categories: ["search", "ai", "productivity"],
    background_color: "#171717",
    // icons: [
    //   {
    //     src: "/icon-maskable.png",
    //     sizes: "512x512",
    //     type: "image/png",
    //     purpose: "maskable"
    //   },
    //   {
    //     src: "/faviocn.svg",
    //     sizes: "any",
    //     type: "image/svg+xml"
    //   },
    //   {
    //     src: "/icon.png",
    //     sizes: "512x512",
    //     type: "image/png"
    //   },
    //   {
    //     src: "/apple-icon.png",
    //     sizes: "180x180",
    //     type: "image/png"
    //   }
    // ]
  }
}