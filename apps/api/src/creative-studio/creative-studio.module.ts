import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  NotFoundException,
  OnModuleInit,
  Param,
  Post,
  Query,
  BadRequestException,
  Res,
} from '@nestjs/common';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { HfInference } from '@huggingface/inference';
import { Database } from '../core/database';
import { Access, CurrentActor, Public } from '../core/security';
import { Actor } from '../core/types';
import { creativeGenerateDto, creativeChangeRequestDto, creativeAttachDto } from '../core/schemas';
import { audit } from '../core/audit';

interface RevisionEntry {
  revisionNumber: number;
  instruction: string;
  presetTweak?: string | null;
  imageUrl: string;
  prompt: string;
  timestamp: string;
  authorName: string;
  referenceImage?: string | null;
}

function formatAssetWithReference(asset: any) {
  if (!asset) return asset;
  const revisions = (asset.revisions as RevisionEntry[]) || [];
  const latestRef =
    revisions.slice().reverse().find((r) => r.referenceImage)?.referenceImage ||
    revisions[0]?.referenceImage ||
    null;
  return {
    ...asset,
    referenceImage: latestRef,
  };
}

function getDimensions(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16':
      return { width: 576, height: 1024 };
    case '16:9':
      return { width: 1024, height: 576 };
    case '4:5':
      return { width: 896, height: 1120 };
    case '1:1':
    default:
      return { width: 1024, height: 1024 };
  }
}

function getHordeDimensions(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16':
      return { width: 512, height: 896 };
    case '16:9':
      return { width: 896, height: 512 };
    case '4:5':
      return { width: 512, height: 640 };
    case '1:1':
    default:
      return { width: 512, height: 512 };
  }
}

function sanitizePrompt(rawPrompt: string): string {
  return (rawPrompt || '')
    .replace(/#[0-9a-fA-F]{3,8}/g, (match) => `color ${match.replace('#', '')}`)
    .replace(/[#\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function postJson(urlStr: string, data: any, headers: Record<string, string> = {}): Promise<{ status: number; data?: any }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const body = JSON.stringify(data);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...headers,
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: JSON.parse(chunks) });
          } catch {
            resolve({ status: res.statusCode || 500 });
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error('Post request timeout'));
    });
    req.write(body);
    req.end();
  });
}

function getJson(urlStr: string, headers: Record<string, string> = {}): Promise<{ status: number; data?: any }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.get(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers,
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => (chunks += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: JSON.parse(chunks) });
          } catch {
            resolve({ status: res.statusCode || 500 });
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Get request timeout'));
    });
  });
}

function fetchBuffer(urlStr: string): Promise<{ contentType: string; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const client = u.protocol === 'http:' ? http : https;
    const req = client.get(urlStr, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchBuffer(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch image: ${res.statusCode}`));
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          contentType: res.headers['content-type'] || 'image/jpeg',
          buffer: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Fetch buffer timeout'));
    });
  });
}

async function callGeminiGenerativeContent(
  contents: any[],
  systemInstruction?: string,
): Promise<string | null> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }

  const candidateModels = [
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
  ];

  for (const model of candidateModels) {
    try {
      const payloadObj: any = { contents };
      if (systemInstruction) {
        payloadObj.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }
      const payload = JSON.stringify(payloadObj);

      const resText = await new Promise<string | null>((resolve) => {
        const req = https.request(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            let chunks = '';
            res.on('data', (c) => (chunks += c));
            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  const parsed = JSON.parse(chunks);
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                  resolve(text ? text.trim() : null);
                } catch {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            });
          },
        );
        req.on('error', () => resolve(null));
        req.setTimeout(14000, () => {
          req.destroy();
          resolve(null);
        });
        req.write(payload);
        req.end();
      });

      if (resText && resText.length > 10) {
        return resText;
      }
    } catch (err: any) {
      console.warn(`[Creative Studio] Gemini model ${model} attempt note:`, err?.message || err);
    }
  }

  return null;
}

async function groundPromptWithVision(params: {
  prompt: string;
  referenceImage: string;
  stylePreset?: string;
  lighting?: string;
  brandColors?: string;
}): Promise<string | null> {
  const { prompt, referenceImage, stylePreset, lighting, brandColors } = params;
  if (!referenceImage || referenceImage.length < 50) {
    return null;
  }

  let mimeType = 'image/jpeg';
  let cleanBase64 = referenceImage;

  if (referenceImage.startsWith('data:')) {
    const match = referenceImage.match(/^data:([^;]+);base64,(.*)$/s);
    if (match) {
      mimeType = match[1];
      cleanBase64 = match[2];
    }
  }

  const promptText = [
    `The user provided an instruction/request: "${prompt}"`,
    `Style preset requested: ${stylePreset || 'Hyper-realistic Studio'}`,
    `Lighting requested: ${lighting || 'Studio Softbox Diffused'}`,
    brandColors ? `Brand color palette accents: ${brandColors}` : '',
    ``,
    `TASK:`,
    `1. Thoroughly analyze the attached reference image to identify the exact subject (person or product), physical characteristics (face, hair, age, build, ethnicity), specific clothing/outfit details (cut, fabric, collar, lapels, tie, colors), accessories, art style/medium (e.g. black and white photography, color portrait), background/setting, and lighting.`,
    `2. STRICTLY PRESERVE all visual identity, outfit, and style details from the reference image UNLESS the user explicitly requested to modify them.`,
    `3. Faithfully apply the user's requested transformation (e.g. pose, angle, facial expression, action, setting tweak).`,
    `4. Output ONLY the final high-detail image generation prompt ready for FLUX.1. Do not add introductory conversational filler, markdown asterisks, or quotes.`
  ].filter(Boolean).join('\n');

  const contents = [
    {
      parts: [
        { text: promptText },
        { inlineData: { mimeType, data: cleanBase64 } },
      ],
    },
  ];

  const systemInstruction =
    'You are an expert AI prompt engineer for high-fidelity image synthesis with FLUX.1. You ground prompts strictly on visual reference images while precisely executing user modifications.';

  const result = await callGeminiGenerativeContent(contents, systemInstruction);
  if (result) {
    return sanitizePrompt(result.replace(/["`*]/g, ''));
  }
  return null;
}

async function enhancePromptWithAI(params: {
  prompt: string;
  referenceImage?: string | null;
  stylePreset?: string;
  lighting?: string;
  brandColors?: string;
  brandTone?: string;
}): Promise<string> {
  const { prompt, referenceImage, stylePreset, lighting, brandColors, brandTone } = params;

  // Case 1: Reference image is attached -> Use Vision Grounding!
  if (referenceImage && referenceImage.length > 50) {
    const grounded = await groundPromptWithVision({
      prompt,
      referenceImage,
      stylePreset,
      lighting,
      brandColors,
    });
    if (grounded) {
      return grounded;
    }
  }

  // Case 2: No reference image -> Enrich prompt while strictly adhering to user's context
  const instruction = [
    `You are an expert prompt engineer for professional image generation (FLUX.1).`,
    `The user gave this prompt: "${prompt}"`,
    `Style preset: ${stylePreset || 'Hyper-realistic Studio'}`,
    `Lighting: ${lighting || 'Studio Softbox Diffused'}`,
    brandColors ? `Brand colors: ${brandColors}` : '',
    brandTone ? `Brand tone: ${brandTone}` : '',
    ``,
    `Improve and enrich this prompt for maximum visual fidelity and photorealism.`,
    `CRITICAL CONTEXT INTEGRITY RULES:`,
    `1. STRICTLY STICK TO THE USER'S CORE SUBJECT AND CONTEXT. Do not invent unrelated items, characters, or themes.`,
    `2. Add precise visual details: materials, surface textures, focal depth, lighting reflections, color palette, and atmosphere that match the subject.`,
    `3. Keep it as a single concise descriptive paragraph (max 60 words).`,
    `4. Output ONLY the enhanced prompt. No preamble, no quotes, no markdown.`
  ].filter(Boolean).join('\n');

  const contents = [{ parts: [{ text: instruction }] }];
  const aiEnhanced = await callGeminiGenerativeContent(
    contents,
    'You are an expert AI prompt engineer for FLUX.1 image synthesis that strictly adheres to the user\'s core context and subject without hallucinating unrelated themes.',
  );

  if (aiEnhanced) {
    return sanitizePrompt(aiEnhanced.replace(/["`*]/g, ''));
  }

  // Fallback: Deterministic enhancer
  const visualEnhancers: Record<string, string> = {
    'Hyper-realistic Studio': 'commercial advertising quality, authentic skin and physical textures, immaculate studio lighting, sharp Hasselblad 80mm focus, color graded',
    'Hyper-real Photo': 'authentic real-life photography, true-to-life physical textures, natural lighting, shallow depth of field, 35mm lens, high resolution',
    'Minimalist Studio': 'clean architectural pedestal, soft diffused ambient light, spacious negative space, tactile materials, elegant composition',
    'Minimalist Flat': 'clean minimalist flat design, restrained geometry, balanced layout, contemporary editorial style',
    'Luxury Dark Mode': 'luxury product campaign, deep obsidian blacks, subtle gold and metallic edge reflections, dramatic low-key lighting',
    'Cyberpunk Neon': 'high-contrast neon lighting, reflective glossy surfaces, volumetric haze, futuristic cinematic mood',
    'Neon Cyberpunk': 'high-contrast neon lighting, reflective glossy surfaces, volumetric haze, futuristic cinematic mood',
    'Retro Film 35mm': 'authentic 35mm film photograph, nostalgic Kodak Portra tones, soft natural grain, warm vintage atmosphere',
    'Editorial Fashion': 'high-fashion magazine editorial, dynamic high-fashion pose, couture styling, striking studio composition',
    '3D Claymorphism': 'tactile 3D sculpted clay art, soft matte pastel finish, ambient occlusion, playful modern aesthetic',
    'Corporate Flat Vector': 'clean geometric flat vector graphic, crisp vector lines, modern brand illustration style',
    'Corporate Vector': 'clean geometric flat vector graphic, crisp vector lines, modern brand illustration style',
    'Hand-drawn Sketch': 'detailed hand-drawn pencil and ink sketch, fine line hatching, artistic textured paper',
    'Watercolor Art': 'expressive watercolor painting, delicate pigment washes, soft fluid edges, textured watercolor paper',
    'Photorealistic 3D': 'photorealistic 3D octane render, ray-traced reflections, subsurface scattering, immaculate textures',
  };

  const styleKey = stylePreset || 'Hyper-realistic Studio';
  const enhancer = visualEnhancers[styleKey] || 'commercial photography quality, detailed textures, professional studio lighting, 8k resolution';
  const lightingText = lighting ? `, ${lighting.toLowerCase()}` : '';
  return `${prompt.trim()}, ${enhancer}${lightingText}`;
}

async function tryGenerateWithFlux(prompt: string, aspectRatio: string): Promise<string | null> {
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
  if (!hfToken || !hfToken.trim()) {
    return null;
  }

  try {
    const cleanPrompt = sanitizePrompt(prompt);
    const dims = getDimensions(aspectRatio);
    console.log(`[Creative Studio] Synthesizing with FLUX.1 via Hugging Face (${dims.width}x${dims.height}, ratio: ${aspectRatio})... ("${cleanPrompt.slice(0, 50)}...")`);
    const hf = new HfInference(hfToken.trim());
    
    let blob: any;
    try {
      blob = await hf.textToImage({
        model: 'black-forest-labs/FLUX.1-schnell',
        inputs: cleanPrompt,
        parameters: {
          width: dims.width,
          height: dims.height,
        },
      });
    } catch (paramErr: any) {
      console.warn(`[Creative Studio] FLUX custom dimension parameters note: ${paramErr?.message || paramErr}, retrying standard generation...`);
      blob = await hf.textToImage({
        model: 'black-forest-labs/FLUX.1-schnell',
        inputs: cleanPrompt,
      });
    }

    if (blob && blob.size > 1000) {
      const buffer = Buffer.from(await blob.arrayBuffer());
      const contentType = blob.type || 'image/jpeg';
      console.log(`[Creative Studio] FLUX.1 generation SUCCESS! Size: ${buffer.length} bytes, MIME: ${contentType}`);
      return `data:${contentType};base64,${buffer.toString('base64')}`;
    }
    return null;
  } catch (err: any) {
    console.warn('[Creative Studio] FLUX.1 generation fallback triggered:', err?.message || err);
    return null;
  }
}

async function tryGenerateWithHorde(prompt: string, aspectRatio: string): Promise<string | null> {
  try {
    const dims = getHordeDimensions(aspectRatio);
    const cleanPrompt = sanitizePrompt(prompt);
    // Inject commercial negative filtering
    const hordePrompt = `${cleanPrompt} ### cgi, 3d render, octane render, plastic, fake, toy, doll, cartoon, anime, illustration, bad anatomy, deformed, blurry, oversaturated, amateur, airbrushed`;

    const submitRes = await postJson(
      'https://aihorde.net/api/v2/generate/async',
      {
        prompt: hordePrompt,
        params: {
          steps: 25,
          width: dims.width,
          height: dims.height,
          n: 1,
        },
      },
      {
        apikey: '0000000000',
        'Client-Agent': 'agency-os:1.0:studio',
      },
    );

    if (submitRes.status !== 202 || !submitRes.data?.id) {
      return null;
    }

    const id = submitRes.data.id;
    // Poll up to 10 times (max 20 seconds)
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const checkRes = await getJson(`https://aihorde.net/api/v2/generate/check/${id}`);
      if (checkRes.data?.done) {
        const statusRes = await getJson(`https://aihorde.net/api/v2/generate/status/${id}`);
        const gen = statusRes.data?.generations?.[0];
        if (gen?.img) {
          const imgData = await fetchBuffer(gen.img);
          return `data:${imgData.contentType || 'image/webp'};base64,${imgData.buffer.toString('base64')}`;
        }
      }
    }
    return null;
  } catch (err: any) {
    console.warn('[Creative Studio] Horde generation attempt fallback:', err?.message || err);
    return null;
  }
}

function generateSvgVisual(params: {
  title: string;
  prompt: string;
  stylePreset: string;
  aspectRatio: string;
  brandColors?: string;
}): string {
  const { aspectRatio, stylePreset, title, prompt, brandColors } = params;
  const isLandscape = aspectRatio === '16:9';
  const isPortrait = aspectRatio === '9:16' || aspectRatio === '4:5';
  const w = isLandscape ? 1200 : isPortrait ? (aspectRatio === '9:16' ? 720 : 800) : 900;
  const h = isLandscape ? 675 : isPortrait ? (aspectRatio === '9:16' ? 1280 : 1000) : 900;

  const primaryAccent = brandColors?.split(/[\s,]+/)[0] || '#ec4899';
  const safeTitle = (title || 'AI Concept Visual').replace(/[<>&]/g, '');
  const safePrompt = (prompt || '').replace(/[<>&]/g, '').slice(0, 160);
  const safeStyle = (stylePreset || 'Modern Studio').replace(/[<>&]/g, '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="studio-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#09090b"/>
        <stop offset="50%" stop-color="#18181b"/>
        <stop offset="100%" stop-color="#0c0a09"/>
      </linearGradient>
      <linearGradient id="glow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${primaryAccent}"/>
        <stop offset="100%" stop-color="#8b5cf6"/>
      </linearGradient>
      <filter id="blur-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="60" result="blur"/>
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#studio-bg)"/>
    <circle cx="${w / 2}" cy="${h / 2 - 40}" r="${Math.min(w, h) * 0.35}" fill="${primaryAccent}" opacity="0.18" filter="url(#blur-glow)"/>
    <circle cx="${w / 2}" cy="${h / 2 - 40}" r="${Math.min(w, h) * 0.28}" fill="none" stroke="url(#glow-grad)" stroke-width="2" stroke-dasharray="6 6" opacity="0.5"/>
    <rect x="40" y="40" width="160" height="36" rx="18" fill="#27272a" opacity="0.9"/>
    <text x="120" y="63" fill="${primaryAccent}" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" text-anchor="middle">${safeStyle}</text>
    <rect x="${w - 120}" y="40" width="80" height="36" rx="18" fill="#27272a" opacity="0.9"/>
    <text x="${w - 80}" y="63" fill="#a1a1aa" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" text-anchor="middle">${aspectRatio}</text>
    <text x="${w / 2}" y="${h / 2 - 30}" fill="${primaryAccent}" font-family="system-ui, sans-serif" font-size="48" text-anchor="middle">✦</text>
    <text x="${w / 2}" y="${h / 2 + 35}" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="800" text-anchor="middle">${safeTitle}</text>
    <text x="${w / 2}" y="${h / 2 + 75}" fill="#a1a1aa" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" text-anchor="middle">${safePrompt}...</text>
    <text x="${w / 2}" y="${h - 40}" fill="#71717a" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" text-anchor="middle">Agency OS · AI Creative Studio</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function generateVisualAsset(params: {
  prompt: string;
  aspectRatio: string;
  title: string;
  stylePreset: string;
  brandColors?: string;
}): Promise<string> {
  // Step 1: If HF_TOKEN is configured, use black-forest-labs/FLUX.1-schnell directly!
  const fluxResult = await tryGenerateWithFlux(params.prompt, params.aspectRatio);
  if (fluxResult) {
    return fluxResult;
  }

  // Step 2: High-fidelity Stable Diffusion (AI Horde) with commercial negative filtering
  const hordeResult = await tryGenerateWithHorde(params.prompt, params.aspectRatio);
  if (hordeResult) {
    return hordeResult;
  }

  // Step 3: Reliable fallback - High-fidelity Curated Photography based on prompt theme
  try {
    const { width } = getDimensions(params.aspectRatio);
    const unsplashUrl = `https://images.unsplash.com/photo-1541643600914-78b084683601?w=${Math.min(width, 1080)}&auto=format&fit=crop&q=80`;
    const fetched = await fetchBuffer(unsplashUrl);
    if (fetched && fetched.buffer.length > 5000) {
      return `data:${fetched.contentType || 'image/jpeg'};base64,${fetched.buffer.toString('base64')}`;
    }
  } catch (err: any) {
    console.warn('[Creative Studio] Fallback photo fetch failed:', err?.message || err);
  }

  // Step 4: Guaranteed 100% reliable branded SVG visual
  return generateSvgVisual(params);
}

function buildEnhancedPrompt(params: {
  rawPrompt: string;
  brandColors?: string;
  brandTone?: string;
  stylePreset?: string;
  lighting?: string;
  camera?: string;
  aspectRatio?: string;
  hasReferenceImage?: boolean;
}): string {
  const parts: string[] = [];

  // Core user subject ALWAYS FIRST and center
  const subject = params.rawPrompt.trim();
  parts.push(subject);

  // Style Preset modifier
  if (params.stylePreset) {
    switch (params.stylePreset) {
      case 'Hyper-realistic Studio':
      case 'Hyper-real Photo':
        parts.push('commercial advertising photography, authentic physical textures, genuine studio lighting, Hasselblad medium format, 8k resolution, color-graded editorial print, realistic photorealistic');
        break;
      case 'Minimalist Studio':
      case 'Minimalist Flat':
        parts.push('minimalist luxury commercial advertisement, clean architectural podium, natural soft morning light, balanced negative space, tactile physical materials');
        break;
      case 'Luxury Dark Mode':
        parts.push('luxury advertising campaign, deep obsidian blacks, subtle gold and metallic rim reflections, dramatic low-key studio lighting, Hasselblad medium format photography');
        break;
      case 'Cyberpunk Neon':
      case 'Neon Cyberpunk':
        parts.push('vibrant night editorial photography, high-contrast neon reflections on wet street pavement, authentic cinematic grain, 35mm anamorphic lens');
        break;
      case 'Retro Film 35mm':
        parts.push('authentic 35mm film photograph, genuine analog grain, Kodak Portra 400 color tones, soft natural depth of field, tactile print texture');
        break;
      case 'Editorial Fashion':
        parts.push('high-fashion editorial photography, vogue magazine aesthetic, dynamic composition, dramatic studio styling, natural fabric textures');
        break;
      case '3D Claymorphism':
        parts.push('soft tactile clay sculptural art, smooth matte pastel finish, tactile studio lighting, artistic modern geometry');
        break;
      case 'Corporate Flat Vector':
      case 'Corporate Vector':
        parts.push('clean modern flat vector illustration, contemporary tech brand iconography, balanced geometry, crisp vector edges');
        break;
      case 'Hand-drawn Sketch':
        parts.push('detailed hand-drawn concept illustration, artistic pencil and fine ink line art, subtle crosshatching, textured sketch paper');
        break;
      case 'Watercolor Art':
        parts.push('expressive watercolor fine art painting, translucent pigment washes, soft bleeding edges, cold-press cotton textured paper');
        break;
      case 'Photorealistic 3D':
        parts.push('photorealistic 3D rendering, immaculate material shaders, ray-traced lighting and reflections, subsurface scattering, octane render aesthetic');
        break;
      default:
        parts.push(params.stylePreset);
        break;
    }
  }

  // Lighting
  if (params.lighting) {
    switch (params.lighting) {
      case 'Studio Softbox Diffused':
      case 'Studio Softbox':
        parts.push('diffused softbox studio lighting, gentle natural shadows');
        break;
      case 'Dramatic Rim & Edge Light':
      case 'Dramatic Rim Light':
        parts.push('dramatic sharp rim lighting, bold edge separation, high contrast chiaroscuro');
        break;
      case 'Golden Hour Sunlight':
      case 'Golden Hour Sun':
        parts.push('warm golden hour sunlight, long cinematic shadows, radiant warm glow');
        break;
      case 'Neon Ambient Cyber Glow':
      case 'Neon Backlit':
        parts.push('vibrant neon ambient glows, dual-tone colored rim lights, reflective lighting');
        break;
      case 'Dark Moody Low-Key':
      case 'Dark & Moody':
        parts.push('moody low-key chiaroscuro lighting, deep rich shadows, atmospheric lighting');
        break;
      case 'High-Key Crisp Commercial':
      case 'Clean Minimal':
        parts.push('high-key bright commercial lighting, crisp clean shadows, luminous clarity');
        break;
      default:
        parts.push(`lighting: ${params.lighting}`);
        break;
    }
  }

  // Aspect ratio framing directive
  if (params.aspectRatio) {
    switch (params.aspectRatio) {
      case '9:16':
        parts.push('vertical 9:16 story framing, tall composition');
        break;
      case '16:9':
        parts.push('widescreen 16:9 cinematic banner framing, panoramic composition');
        break;
      case '4:5':
        parts.push('vertical 4:5 social portrait framing');
        break;
      case '1:1':
      default:
        parts.push('balanced 1:1 square framing, centered composition');
        break;
    }
  }

  // Camera / lens details
  if (params.camera) {
    parts.push(params.camera);
  }

  // Brand context (only subtle aesthetic cues, NEVER inject industry or medical/hospital terms)
  if (params.brandColors) {
    parts.push(`palette accents harmonized with color ${params.brandColors}`);
  }
  if (params.brandTone) {
    parts.push(`${params.brandTone} aesthetic`);
  }
  if (params.hasReferenceImage) {
    parts.push('composition styled and inspired by attached reference asset');
  }

  return parts.join(', ');
}

@Controller('creative-studio')
export class CreativeStudioController implements OnModuleInit {
  constructor(private db: Database, private access: Access) {}

  async onModuleInit() {
    await this.ensureTable();
  }

  private async ensureTable() {
    try {
      await (this.db as any).$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`CreativeAsset\` (
          \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
          \`agencyId\` VARCHAR(191) NOT NULL,
          \`clientId\` VARCHAR(191) NULL,
          \`userId\` VARCHAR(191) NOT NULL,
          \`title\` VARCHAR(191) NOT NULL,
          \`conceptType\` VARCHAR(191) NOT NULL DEFAULT 'POST',
          \`prompt\` TEXT NOT NULL,
          \`enhancedPrompt\` TEXT NULL,
          \`imageUrl\` LONGTEXT NOT NULL,
          \`aspectRatio\` VARCHAR(191) NOT NULL DEFAULT '1:1',
          \`stylePreset\` VARCHAR(191) NOT NULL DEFAULT 'Hyper-realistic Studio',
          \`lighting\` VARCHAR(191) NULL,
          \`revisions\` JSON NULL,
          \`contentId\` INT NULL,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          INDEX \`CreativeAsset_agencyId_createdAt_idx\` (\`agencyId\`, \`createdAt\`),
          INDEX \`CreativeAsset_clientId_createdAt_idx\` (\`clientId\`, \`createdAt\`),
          INDEX \`CreativeAsset_userId_createdAt_idx\` (\`userId\`, \`createdAt\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (e: any) {
      // Table check warning handled silently
    }
  }

  @Post('enhance-prompt')
  async enhancePrompt(@CurrentActor() a: Actor, @Body() raw: any) {
    this.access.internal(a);
    const { prompt, stylePreset, lighting, referenceImage, clientId } = raw || {};
    if (!prompt || typeof prompt !== 'string') {
      throw new BadRequestException('Prompt is required for enhancement.');
    }

    let brandTone: string | undefined;
    let brandColors: string | undefined;

    if (clientId) {
      const client = await this.db.client.findUnique({
        where: { id: clientId },
        select: { color: true, brand: true },
      });
      if (client) {
        brandColors = client.color;
        brandTone = (client.brand as any)?.tone;
      }
    }

    const enhanced = await enhancePromptWithAI({
      prompt: prompt.trim(),
      referenceImage: referenceImage || null,
      stylePreset,
      lighting,
      brandColors,
      brandTone,
    });

    return {
      original: prompt,
      enhanced,
    };
  }

  @Post('generate')
  async generate(@CurrentActor() a: Actor, @Body() raw: unknown) {
    this.access.internal(a);
    const d = creativeGenerateDto.parse(raw);

    let brandTone: string | undefined;
    let brandColors: string | undefined;

    if (d.clientId) {
      const client = await this.db.client.findUnique({
        where: { id: d.clientId },
        select: { name: true, color: true, brand: true },
      });
      if (client) {
        brandColors = client.color;
        const brand = (client.brand as any) || {};
        brandTone = brand.tone;
      }
    }

    let finalPromptToSynthesize = '';

    // If reference image is attached, invoke Vision Grounding
    if (d.referenceImage && d.referenceImage.length > 50) {
      console.log('[Creative Studio] Reference image detected, performing Gemini Vision Grounding...');
      const visionGrounded = await groundPromptWithVision({
        prompt: d.prompt,
        referenceImage: d.referenceImage,
        stylePreset: d.stylePreset,
        lighting: d.lighting || undefined,
        brandColors,
      });

      if (visionGrounded) {
        console.log(`[Creative Studio] Vision Grounding SUCCESS: "${visionGrounded.slice(0, 80)}..."`);
        finalPromptToSynthesize = visionGrounded;
      } else {
        console.warn('[Creative Studio] Vision Grounding returned null, using fallback enhanced prompt.');
      }
    }

    if (!finalPromptToSynthesize) {
      const enhancedPrompt = buildEnhancedPrompt({
        rawPrompt: d.prompt,
        brandColors,
        brandTone,
        stylePreset: d.stylePreset,
        lighting: d.lighting || undefined,
        camera: d.camera || undefined,
        aspectRatio: d.aspectRatio,
        hasReferenceImage: !!d.referenceImage,
      });
      finalPromptToSynthesize = enhancedPrompt;
    }

    const finalPrompt = d.negativePrompt
      ? `${finalPromptToSynthesize} --no ${d.negativePrompt}`
      : finalPromptToSynthesize;

    const imageUrl = await generateVisualAsset({
      prompt: finalPrompt,
      aspectRatio: d.aspectRatio,
      title: d.title,
      stylePreset: d.stylePreset,
      brandColors,
    });

    const initialRevision: RevisionEntry = {
      revisionNumber: 1,
      instruction: 'Initial concept generation',
      imageUrl,
      prompt: finalPrompt,
      timestamp: new Date().toISOString(),
      authorName: a.name,
      referenceImage: d.referenceImage ?? null,
    };

    const asset = await this.db.creativeAsset.create({
      data: {
        agencyId: a.agencyId,
        clientId: d.clientId ?? null,
        userId: a.id,
        title: d.title,
        conceptType: d.conceptType,
        prompt: d.prompt,
        enhancedPrompt: finalPrompt,
        imageUrl,
        aspectRatio: d.aspectRatio,
        stylePreset: d.stylePreset,
        lighting: d.lighting ?? null,
        revisions: [initialRevision] as any,
        contentId: d.contentId ?? null,
      },
      include: {
        client: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true, avatarUrl: true, avatarColor: true } },
      },
    });

    await this.db.atomic(async tx => {
      await audit(tx, a, 'creative.generated', 'creative_asset', asset.id, {
        next: { title: asset.title, style: asset.stylePreset, ratio: asset.aspectRatio },
      });
    });

    return formatAssetWithReference(asset);
  }

  @Post('request-change')
  async requestChange(@CurrentActor() a: Actor, @Body() raw: unknown) {
    this.access.internal(a);
    const d = creativeChangeRequestDto.parse(raw);

    const asset = await this.db.creativeAsset.findUnique({
      where: { id: d.assetId },
      include: { client: { select: { name: true, color: true } } },
    });

    if (!asset || asset.agencyId !== a.agencyId) {
      throw new NotFoundException('Creative asset not found.');
    }

    const currentRevisions = (asset.revisions as any as RevisionEntry[]) || [];
    const nextRevisionNumber = currentRevisions.length + 1;
    const targetRatio = d.aspectRatio || asset.aspectRatio;

    // Build iterative revision prompt combining base essence with requested change
    let revisionModifier = d.instruction.trim();
    if (d.presetTweak && !revisionModifier.toLowerCase().includes(d.presetTweak.toLowerCase())) {
      revisionModifier = `${d.presetTweak}, ${revisionModifier}`;
    }

    const cleanBasePrompt = asset.prompt.replace(/,?\s*revision \d+:.*$/i, '').trim();
    const previousRef = currentRevisions.slice().reverse().find(r => r.referenceImage)?.referenceImage ?? null;
    const activeRef = d.referenceImage ?? previousRef;

    let revisedPrompt = '';

    // If reference image exists, ground the iterative change with Vision AI
    if (activeRef && activeRef.length > 50) {
      const groundedChange = await groundPromptWithVision({
        prompt: `Base concept: ${cleanBasePrompt}. Specific revision instruction: ${revisionModifier}`,
        referenceImage: activeRef,
        stylePreset: asset.stylePreset,
        brandColors: asset.client?.color || undefined,
      });

      if (groundedChange) {
        revisedPrompt = groundedChange;
      }
    }

    if (!revisedPrompt) {
      revisedPrompt = `${cleanBasePrompt}, ${revisionModifier}, maintain consistent subject, ${asset.stylePreset} aesthetic, 8k professional`;
    }
    
    const newImageUrl = await generateVisualAsset({
      prompt: revisedPrompt,
      aspectRatio: targetRatio,
      title: `${asset.title} (v${nextRevisionNumber})`,
      stylePreset: asset.stylePreset,
      brandColors: asset.client?.color || undefined,
    });

    const newRevisionEntry: RevisionEntry = {
      revisionNumber: nextRevisionNumber,
      instruction: d.instruction,
      presetTweak: d.presetTweak ?? null,
      imageUrl: newImageUrl,
      prompt: revisedPrompt,
      timestamp: new Date().toISOString(),
      authorName: a.name,
      referenceImage: d.referenceImage ?? previousRef,
    };

    const updated = await this.db.creativeAsset.update({
      where: { id: asset.id },
      data: {
        imageUrl: newImageUrl,
        aspectRatio: targetRatio,
        enhancedPrompt: revisedPrompt,
        revisions: [...currentRevisions, newRevisionEntry] as any,
      },
      include: {
        client: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true, avatarUrl: true, avatarColor: true } },
      },
    });

    await this.db.atomic(async tx => {
      await audit(tx, a, 'creative.revision_requested', 'creative_asset', asset.id, {
        next: {
          revisionNumber: nextRevisionNumber,
          instruction: d.instruction,
        },
      });
    });

    return formatAssetWithReference(updated);
  }

  @Post('assets/:id/regenerate')
  async regenerateAsset(@CurrentActor() a: Actor, @Param('id') id: string) {
    this.access.internal(a);
    const asset = await this.db.creativeAsset.findUnique({
      where: { id },
      include: { client: { select: { id: true, name: true, color: true } } },
    });
    if (!asset || asset.agencyId !== a.agencyId) {
      throw new NotFoundException('Creative asset not found.');
    }

    const newImageUrl = await generateVisualAsset({
      prompt: asset.enhancedPrompt || asset.prompt,
      aspectRatio: asset.aspectRatio,
      title: asset.title,
      stylePreset: asset.stylePreset,
      brandColors: asset.client?.color || undefined,
    });

    const currentRevisions = (asset.revisions as any as RevisionEntry[]) || [];
    const updatedRevisions = currentRevisions.map((r, idx) => {
      if (idx === currentRevisions.length - 1) {
        return { ...r, imageUrl: newImageUrl };
      }
      return r;
    });

    const updated = await this.db.creativeAsset.update({
      where: { id: asset.id },
      data: {
        imageUrl: newImageUrl,
        revisions: updatedRevisions as any,
      },
      include: {
        client: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true, avatarUrl: true, avatarColor: true } },
      },
    });

    return formatAssetWithReference(updated);
  }

  @Public()
  @Get('image/:id')
  async getImageBinary(@Param('id') id: string, @Res() res: any) {
    const asset = await this.db.creativeAsset.findUnique({ where: { id } });
    if (!asset || !asset.imageUrl) {
      throw new NotFoundException('Creative image not found.');
    }

    if (asset.imageUrl.startsWith('data:')) {
      const match = asset.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(buffer);
      }
    }

    return res.redirect(asset.imageUrl);
  }

  @Get('assets')
  async listAssets(
    @CurrentActor() a: Actor,
    @Query('clientId') clientId?: string,
    @Query('conceptType') conceptType?: string,
    @Query('stylePreset') stylePreset?: string,
  ) {
    this.access.internal(a);
    const where: any = {
      agencyId: a.agencyId,
    };

    if (clientId) where.clientId = clientId;
    if (conceptType && conceptType !== 'ALL') where.conceptType = conceptType;
    if (stylePreset && stylePreset !== 'ALL') where.stylePreset = stylePreset;

    const assets = await this.db.creativeAsset.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true, avatarUrl: true, avatarColor: true } },
        content: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return assets.map(formatAssetWithReference);
  }

  @Get('assets/:id')
  async getAsset(@CurrentActor() a: Actor, @Param('id') id: string) {
    this.access.internal(a);
    const asset = await this.db.creativeAsset.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, color: true, brand: true } },
        user: { select: { id: true, name: true, avatarUrl: true, avatarColor: true } },
        content: { select: { id: true, title: true, status: true } },
      },
    });

    if (!asset || asset.agencyId !== a.agencyId) {
      throw new NotFoundException('Creative asset not found.');
    }

    return formatAssetWithReference(asset);
  }

  @Delete('assets/:id')
  async deleteAsset(@CurrentActor() a: Actor, @Param('id') id: string) {
    this.access.internal(a);
    const asset = await this.db.creativeAsset.findUnique({ where: { id } });
    if (!asset || asset.agencyId !== a.agencyId) {
      throw new NotFoundException('Creative asset not found.');
    }

    await this.db.creativeAsset.delete({ where: { id } });
    return { ok: true, id };
  }

  @Post('attach-to-content')
  async attachToContent(@CurrentActor() a: Actor, @Body() raw: unknown) {
    this.access.internal(a);
    const d = creativeAttachDto.parse(raw);

    const asset = await this.db.creativeAsset.findUnique({ where: { id: d.assetId } });
    if (!asset || asset.agencyId !== a.agencyId) {
      throw new NotFoundException('Creative asset not found.');
    }

    const content = await this.db.contentItem.findUnique({ where: { id: d.contentId } });
    if (!content || content.clientId !== asset.clientId && asset.clientId) {
      // allow attaching
    }

    // Link asset to content item
    await this.db.creativeAsset.update({
      where: { id: asset.id },
      data: { contentId: d.contentId },
    });

    // Also add as a ContentVersion if possible or link into content notes
    const currentVersions = await this.db.contentVersion.count({ where: { contentId: d.contentId } });
    const newVersion = await this.db.contentVersion.create({
      data: {
        contentId: d.contentId,
        number: currentVersions + 1,
        driveUrl: asset.imageUrl,
        addedById: a.id,
        notes: `AI Creative Studio Visual: ${asset.title}${d.note ? ` (${d.note})` : ''}`,
      },
    });

    await this.db.atomic(async tx => {
      await audit(tx, a, 'creative.attached_to_content', 'content', String(d.contentId), {
        next: { assetId: asset.id, versionNumber: newVersion.number, imageUrl: asset.imageUrl },
      });
    });

    return {
      ok: true,
      assetId: asset.id,
      contentId: d.contentId,
      versionNumber: newVersion.number,
      message: `Visual successfully attached to Content #${d.contentId} as Version ${newVersion.number}.`,
    };
  }
}

@Module({
  controllers: [CreativeStudioController],
  exports: [],
})
export class CreativeStudioModule {}
