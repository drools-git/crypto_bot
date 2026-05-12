import { NextResponse } from 'next/server';

/**
 * Debug Log Bridge
 * Prints messages from the client to the server terminal (Bash).
 */
export async function POST(request: Request) {
  try {
    const { message, level = 'info' } = await request.json();
    const timestamp = new Date().toLocaleTimeString();
    
    // Colorful logs in terminal using ANSI codes
    const colors = {
      info: '\x1b[36m', // Cyan
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      success: '\x1b[32m', // Green
      reset: '\x1b[0m'
    };
    
    const color = colors[level as keyof typeof colors] || colors.info;
    
    console.log(`${colors.reset}[${timestamp}] ${color}<< ${message} >>${colors.reset}`);
    
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
