const fs = require('fs');
const path = require('path');

class FriendsManager {
    constructor() {
        this.friendsFile = path.join(__dirname, '../../data/friends.json');
        this.friends = this.loadFriends();
    }

    loadFriends() {
        try {
            if (!fs.existsSync(this.friendsFile)) {
                fs.mkdirSync(path.dirname(this.friendsFile), { recursive: true });
                fs.writeFileSync(this.friendsFile, JSON.stringify({}));
                return {};
            }
            return JSON.parse(fs.readFileSync(this.friendsFile, 'utf8'));
        } catch (error) {
            console.error('Error loading friends:', error);
            return {};
        }
    }

    saveFriends() {
        try {
            fs.writeFileSync(this.friendsFile, JSON.stringify(this.friends, null, 2));
        } catch (error) {
            console.error('Error saving friends:', error);
        }
    }

    addFriend(userId, name, address) {
        if (!this.friends[userId]) {
            this.friends[userId] = {};
        }
        this.friends[userId][name] = address;
        this.saveFriends();
    }

    removeFriend(userId, name) {
        if (this.friends[userId] && this.friends[userId][name]) {
            delete this.friends[userId][name];
            this.saveFriends();
            return true;
        }
        return false;
    }

    getFriend(userId, name) {
        return this.friends[userId]?.[name];
    }

    listFriends(userId) {
        return this.friends[userId] || {};
    }
}

module.exports = new FriendsManager(); 