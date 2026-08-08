import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL;
const AGENT_NAME = process.env.AGENT_NAME;

// don't cache the results
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    if (!LIVEKIT_URL) {
      throw new Error('NEXT_PUBLIC_LIVEKIT_URL is not defined');
    }
    if (!API_KEY) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (!API_SECRET) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    let roomConfig: RoomConfiguration | undefined;
    if (AGENT_NAME) {
      // When AGENT_NAME is set, configure explicit agent dispatch
      roomConfig = RoomConfiguration.fromJson(
        { agents: [{ agentName: AGENT_NAME }] },
        { ignoreUnknownFields: true }
      );
    }

    // Generate participant token
    const participantName = 'user';
    const participantIdentity = `rakshika_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `rakshika_room_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      roomConfig
    );

    const headers = new Headers({
      'Cache-Control': 'no-store',
    });

    return NextResponse.json(
      {
        serverUrl: LIVEKIT_URL,
        roomName,
        participantName,
        participantToken,
      },
      { headers }
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig?: RoomConfiguration
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (roomConfig) {
    at.roomConfig = roomConfig;
  }

  return at.toJwt();
}
