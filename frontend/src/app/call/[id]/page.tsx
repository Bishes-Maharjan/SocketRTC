import VideoCallPage from '@/components/VideoPage';

export default async function Page({params}: {params: {id: string}}) {
  const roomId =  (await params).id;
  console.log(roomId);
  return <VideoCallPage roomId={roomId} />;
}