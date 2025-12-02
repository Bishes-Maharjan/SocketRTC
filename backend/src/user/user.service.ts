import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatService } from 'src/chat/chat.service';
import { StreamService } from 'src/stream/stream.service';
import {
  FriendRequest,
  FriendRequestDocument,
} from './model/friendRequest.model';
import { User, UserDocument } from './model/user.model';
type PopulatedUser = Omit<User, 'friends'> & {
  friends: User[];
};
@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(FriendRequest.name)
    private frModel: Model<FriendRequestDocument>,
    private jwt: JwtService,
    private streamClient: StreamService,
    private chatService: ChatService,
  ) {}

  async getRecommendedUsers(id: string) {
    const currentUser = await this.userModel.findById(id);
    if (!currentUser) throw new NotFoundException('User not found');

    const recommendedUser = await this.userModel.find({
      $and: [
        { _id: { $ne: id } },
        { _id: { $nin: currentUser?.friends } },
        { isOnBoarded: true },
      ],
    });
    return recommendedUser;
  }

  async getMyFriends(id: string) {
    const myFriends = await this.userModel
      .findById(id)
      .select('friends')
      .populate('friends');
    return myFriends;
  }

  async getFriendWithChatRoomId(userId: string) {
    const myFriends = (await this.userModel
      .findById(userId)
      .select('friends')
      .populate('friends')) as PopulatedUser | null;

    if (!myFriends?.friends) return [];

    const result = await Promise.all(
      myFriends.friends.map(async (friend) => {
        const chatRoomId = await this.chatService.getChatRoomId(
          userId,
          friend._id.toString(),
        );
        return { ...friend, chatRoomId };
      }),
    );

    return result;
  }

  async sendFriendRequest(receiver: string, sender: string) {
    const receipent = await this.userModel.findById(receiver);
    if (!receipent) throw new BadRequestException('User doesnt exist');
    if (receipent.friends.includes(sender))
      throw new BadRequestException('Already a friend');

    const requestExist = await this.frModel.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender },
      ],
    });

    if (requestExist.length > 0) {
      return { message: 'A friend request already exist', requestExist };
    }

    const friendRequest = new this.frModel({
      sender: sender,
      receiver: receiver,
      status: 'pending',
    });
    await friendRequest.save();

    return friendRequest;
  }

  async getFriendRequest(us: string) {
    const incomingFriendRequest = await this.frModel
      .find({
        receiver: us,
        status: 'pending',
      })
      .populate(
        'sender',
        'fullName image nativeLanguage learningLanguage location bio',
      );

    const accpetedFriendRequest = await this.frModel
      .find({
        sender: us,
        status: 'accepted',
      })
      .populate('receiver');

    const rejectedFriendRequest = await this.frModel
      .find({
        sender: us,
        status: 'rejected',
      })
      .populate('receiver');

    const allFr = await this.frModel.find({});
    return {
      allFr,
      incomingFriendRequest,
      accpetedFriendRequest,
      rejectedFriendRequest,
    };
  }

  async getOutGoingFriendRequest(us: string) {
    const outgoingRequest = await this.frModel
      .find({
        sender: us,
        status: 'pending',
      })
      .populate(
        'receiver',
        'fullName image nativeLanguage learningLanguage location bio',
      )
      .exec();
    return outgoingRequest;
  }
  async acceptFriendRequest(receiver: string, requestId: string) {
    const friendRequest = await this.frModel.findById(requestId);

    if (!friendRequest) throw new NotFoundException('fr doesnt exist');

    if (friendRequest.receiver.toString() !== receiver)
      throw new BadRequestException('You cant accept the friend request');

    friendRequest.status = 'accepted';
    await friendRequest.save();
    const { sender } = friendRequest;

    await Promise.all([
      this.userModel.findByIdAndUpdate(receiver, {
        $addToSet: { friends: sender },
      }),
      this.userModel.findByIdAndUpdate(sender, {
        $addToSet: { friends: receiver },
      }),
    ]);
    const senderDocument = await this.userModel.findById(sender);
    if (!senderDocument) throw new NotFoundException('The user doesnt exist');
    const senderId = senderDocument._id.toString();
    const receiverId = receiver.toString();
    await this.chatService.createChatRoomId(senderId, receiverId);

    return {
      message: `Friend request from ${senderDocument.fullName} accepted`,
    };
  }
  async rejectFriendRequest(receiver: string, requestId: string) {
    let friendRequest: FriendRequestDocument | null = null;
    friendRequest = await this.frModel.findById(requestId);

    if (!friendRequest) throw new NotFoundException('fr doesnt exist');
    const sender = await this.userModel.findById(friendRequest.sender);
    if (friendRequest.receiver.toString() !== receiver)
      throw new BadRequestException('You cant deny the friend request');

    await this.frModel.findByIdAndUpdate(requestId, { status: 'rejected' });

    return { message: `Friend Request from ${sender?.fullName} rejected` };
  }

  async getUserById(id: string) {
    const user = await this.userModel.findById(id);

    return user;
  }

  async getAllUsers() {
    const users = await this.userModel.find({});
    return users;
  }
}
