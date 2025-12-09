import VideoCallPage from '@/components/VideoPage';
import { JSX } from 'react';

export default async function Page({params}: {params: Promise<{id: string}>}): Promise<JSX.Element> {
  const roomId =  (await params).id;

  return <VideoCallPage roomId={roomId} />;
}