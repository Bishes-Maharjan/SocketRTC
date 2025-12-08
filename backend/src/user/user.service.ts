import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatService } from 'src/chat/chat.service';

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
    private chatService: ChatService,
  ) {}

  //FRIEND LOGIC:
  async getRecommendedUsers(id: string) {
    const currentUser = await this.userModel.findById({ _id: id });
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
  //used in frontend to render user with chatId with them which will
  async getFriendWithChatRoomId(id: string) {
    const myFriends = (await this.userModel
      .findById({ _id: id })
      .select('friends')
      .populate('friends')
      .lean()) as PopulatedUser | null;

    if (!myFriends) throw new NotFoundException('Friends dont exist');

    const result = await Promise.all(
      myFriends.friends.map(async (friend) => {
        const chatRoomId = await this.chatService.getChatRoomId(
          id,
          friend._id.toString(),
        );
        return { ...friend, chatRoomId };
      }),
    );


    return result;
  }

  //sending fr by us
  async sendFriendRequest(receiver: string, sender: string) {
    const receipent = await this.userModel.findById(receiver);
    if (!receipent) throw new BadRequestException('User doesnt exist');
    if (receipent.friends.includes(sender))
      throw new BadRequestException('Already a friend');

    const requestExist = await this.frModel.find({
      status: 'pending',
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender },
      ],
    });

    if (requestExist.length > 0) {
      return {
        message: 'A friend request already exist',
      };
    }

    const friendRequest = new this.frModel({
      sender: sender,
      receiver: receiver,
      status: 'pending',
    });
    await friendRequest.save();

    return friendRequest;
  }
  //getting fr sent to us
  async getFriendRequest(us: string) {
    const incomingFriendRequest = await this.frModel
      .find({
        receiver: us,
        status: 'pending',
      })
      .populate('sender')
      .sort({ createdAt: -1 });

    const accpetedFriendRequest = await this.frModel
      .find({
        sender: us,
        status: 'accepted',
      })
      .populate('receiver')
      .sort({ createdAt: -1 });

    const rejectedFriendRequest = await this.frModel
      .find({
        sender: us,
        status: 'rejected',
      })
      .populate('receiver')
      .sort({ createdAt: -1 });

    const allFr = await this.frModel.find({});

    return {
      allFr,
      incomingFriendRequest,
      accpetedFriendRequest,
      rejectedFriendRequest,
    };
  }

  // used for to see if this has sender: us and fr exists to show in ui, we have alr sent fr
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

  //accepting the request by updating its status
  async acceptFriendRequest(receiver: string, requestId: string) {
    const friendRequest = await this.frModel.findById(requestId);
    if (!friendRequest) throw new NotFoundException('fr doesnt exist');

    if (friendRequest.receiver.toString() !== receiver)
      throw new BadRequestException('You cant accept the friend request');

    friendRequest.status = 'accepted';
    friendRequest.isRead = false;
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
  //rejecting the fr by updating its status to rejected
  async rejectFriendRequest(receiver: string, requestId: string) {
    let friendRequest: FriendRequestDocument | null = null;
    friendRequest = await this.frModel.findById(requestId);

    if (!friendRequest) throw new NotFoundException('fr doesnt exist');

    const sender = await this.userModel.findById(friendRequest.sender);
    if (friendRequest.receiver.toString() !== receiver)
      throw new BadRequestException('You cant deny the friend request');

    await this.frModel.findByIdAndUpdate(requestId, {
      status: 'rejected',
      isRead: false,
    });

    return { message: `Friend Request from ${sender?.fullName} rejected` };
  }

  // ---------------------------------------------------------------
  //USER LOGIC:
  async getUserById(id: string) {
    const user = await this.userModel.findById(id);
    return user;
  }

  async getAllUsers() {
    const users = await this.userModel.find({});
    return users;
  }

  //----------------------------------------------------------------
  //NOTIFICATION LOGIC:
  async getTotalNotification(us: string) {
    const count = await this.frModel.countDocuments({
      isRead: false,
      $or: [
        { sender: us, status: { $in: ['accepted', 'rejected'] } },
        { receiver: us, status: 'pending' },
      ],
    });

    return count;
  }
  async readAllNotifications(us: string) {
    const updateAll = await this.frModel.updateMany(
      {
        isRead: false,
        $or: [
          { sender: us, status: { $in: ['accepted', 'rejected'] } },
          { receiver: us, status: 'pending' },
        ],
      },
      { $set: { isRead: true } },
    );

    return {
      success: true,
      message: 'Read All Notification',
      modifiedCount: updateAll.modifiedCount,
    };
  }

  async delAllFr() {
    const del = await this.frModel.deleteMany({});
    if (!del) throw new InternalServerErrorException('Something went wrong');
    return { success: true, message: 'deleted all fr' };
  }
}
