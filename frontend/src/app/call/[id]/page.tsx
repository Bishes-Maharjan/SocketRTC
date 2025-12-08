import VideoCallPage from '@/components/VideoPage';

export default async function Page({params}: {params: {id: string}}) {
  const roomId =  (await params).id;

  return <VideoCallPage roomId={roomId} />;
}