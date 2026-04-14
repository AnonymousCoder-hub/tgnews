import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import translate from 'google-translate-api-x';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Channels that need translation (Arabic)
const TRANSLATE_CHANNELS = new Set(['SabrenNewss', 'AjaNews']);

// Secret for authorization
const API_SECRET = process.env.API_SECRET || 'newstel-internal-2024';

/**
 * POST /api/translate-existing
 * 
 * Re-translates ALL existing Arabic messages in the database
 */
export async function POST(request: NextRequest) {
  // Auth check
  const providedSecret = request.headers.get('x-api-secret');
  if (providedSecret !== API_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ success: false, error: 'Missing Supabase config' }, { status: 500 });
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch ALL messages from channels that need translation (with pagination)
    console.log('[TRANSLATE-EXISTING] Fetching all Arabic messages...');
    const allMessages: { id: string; text: string | null; channelusername: string }[] = [];
    const batchSize = 500;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: fetchError } = await client
        .from('messages')
        .select('id, text, channelusername')
        .in('channelusername', Array.from(TRANSLATE_CHANNELS))
        .not('text', 'is', null)
        .range(offset, offset + batchSize - 1);

      if (fetchError) {
        console.error('[TRANSLATE-EXISTING] Fetch error:', fetchError);
        return NextResponse.json({ success: false, error: 'Failed to fetch messages' }, { status: 500 });
      }

      if (batch && batch.length > 0) {
        allMessages.push(...batch);
        offset += batchSize;
        hasMore = batch.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    if (allMessages.length === 0) {
      return NextResponse.json({ success: true, found: 0, translated: 0, message: 'No messages to translate' });
    }

    console.log(`[TRANSLATE-EXISTING] Found ${allMessages.length} total messages to translate`);

    // Translate in batches of 10
    const translated: { id: string; text: string }[] = [];
    const chunks = [];
    for (let i = 0; i < allMessages.length; i += 10) {
      chunks.push(allMessages.slice(i, i + 10));
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await Promise.all(
        chunk.map(async (msg) => {
          if (!msg.text) return;
          
          try {
            // Add 5 second timeout
            const result = await Promise.race([
              translate(msg.text, { to: 'en' }),
              new Promise<{ text: string }>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 5000)
              )
            ]);
            
            if (result.text && result.text !== msg.text) {
              translated.push({ id: msg.id, text: result.text });
            }
          } catch (e) {
            // Skip on error - message stays in Arabic
          }
        })
      );
      
      // Log progress every 10 chunks
      if ((i + 1) % 10 === 0) {
        console.log(`[TRANSLATE-EXISTING] Progress: ${i + 1}/${chunks.length} chunks, ${translated.length} translated`);
      }
      
      // Small delay between chunks to avoid rate limiting
      if (chunks.length > 1) {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    // Update database with translations
    let updatedCount = 0;
    for (const item of translated) {
      const { error: updateError } = await client
        .from('messages')
        .update({ text: item.text })
        .eq('id', item.id);

      if (!updateError) {
        updatedCount++;
      }
    }

    console.log(`[TRANSLATE-EXISTING] Complete: Updated ${updatedCount} messages`);

    return NextResponse.json({
      success: true,
      found: allMessages.length,
      translated: updatedCount,
      message: `Translated ${updatedCount} of ${allMessages.length} messages`
    });

  } catch (error) {
    console.error('[TRANSLATE-EXISTING] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
