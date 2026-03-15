import { NextRequest } from 'next/server';
import { getAllChannels, CHANNELS } from '@/lib/telegram-scraper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_SECRET = process.env.API_SECRET || 'newstel-internal-2024';

export async function GET(request: NextRequest) {
  // Verify secret
  const providedSecret = request.headers.get('x-api-secret');
  if (providedSecret !== API_SECRET) {
    return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 });
  }

  const encoder = new TextEncoder();
  
  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Step 1: Connecting
        sendProgress({
          step: 1,
          status: 'connecting',
          message: 'Connecting to database...',
          progress: 10
        });

        await new Promise(r => setTimeout(r, 200));

        // Step 2: Fetching channels
        sendProgress({
          step: 2,
          status: 'fetching',
          message: 'Fetching Telegram channels...',
          channels: CHANNELS.map(c => ({ name: c, status: 'pending' })),
          progress: 20
        });

        // Channel display names
        const channelNames: Record<string, string> = {
          'wfwitness': 'WF Witness',
          'warmonitors': 'War Monitors',
          'ethanlevins': 'Ethan Levins',
          'Middle_East_Spectator': 'Middle East Spectator',
          'rnintel': 'Rerum Novarum'
        };

        // Step 3: Load each channel with progress (simulated for visual feedback)
        for (let i = 0; i < CHANNELS.length; i++) {
          const channel = CHANNELS[i];
          const progress = 20 + Math.round((i / CHANNELS.length) * 40);
          
          sendProgress({
            step: 3,
            status: 'loading',
            message: `Loading ${channelNames[channel] || channel}...`,
            channels: CHANNELS.map((c, idx) => ({
              name: c,
              displayName: channelNames[c] || c,
              status: idx < i ? 'done' : idx === i ? 'loading' : 'pending'
            })),
            progress
          });

          await new Promise(r => setTimeout(r, 150));
        }

        // Step 4: Actual data fetch from Supabase/Telegram
        sendProgress({
          step: 4,
          status: 'processing',
          message: 'Processing messages...',
          progress: 70
        });

        const result = await getAllChannels(false);

        sendProgress({
          step: 5,
          status: 'complete',
          message: `Loaded ${result.messages.length} messages from ${result.channels.length} channels`,
          progress: 100,
          data: {
            channels: result.channels,
            messages: result.messages,
            lastUpdated: result.lastUpdated
          }
        });

      } catch (error) {
        sendProgress({
          step: -1,
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to load data',
          progress: 0
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
