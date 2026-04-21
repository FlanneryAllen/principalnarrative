/**
 * Webex Harvester
 * Extracts narrative units from Webex meetings and conversations
 */

const BaseHarvester = require('./base-harvester');

class WebexHarvester extends BaseHarvester {
  constructor(config = {}) {
    super({
      ...config,
      rateLimit: { requestsPerSecond: 10 } // Webex rate limit: 600/min = 10/sec
    });

    this.accessToken = config.accessToken || process.env.WEBEX_ACCESS_TOKEN;
    this.refreshToken = config.refreshToken || process.env.WEBEX_REFRESH_TOKEN;
    this.clientId = config.clientId || process.env.WEBEX_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.WEBEX_CLIENT_SECRET;
    this.apiUrl = 'https://webexapis.com/v1';
  }

  /**
   * Authenticate with Webex
   */
  async authenticate() {
    if (!this.accessToken) {
      if (this.refreshToken && this.clientId && this.clientSecret) {
        await this.refreshAccessToken();
      } else {
        throw new Error('Webex access token or refresh credentials required');
      }
    }

    // Test authentication
    try {
      await this.makeRequest(`${this.apiUrl}/people/me`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      console.log('[WebexHarvester] Authentication successful');
    } catch (error) {
      // Try to refresh token if authentication fails
      if (this.refreshToken && error.message.includes('401')) {
        await this.refreshAccessToken();
        // Retry authentication test
        await this.makeRequest(`${this.apiUrl}/people/me`, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        });
      } else {
        throw new Error(`Webex authentication failed: ${error.message}`);
      }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    console.log('[WebexHarvester] Refreshing access token...');

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret
    });

    const response = await this.makeRequest('https://webexapis.com/v1/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    this.accessToken = response.access_token;
    if (response.refresh_token) {
      this.refreshToken = response.refresh_token;
    }

    console.log('[WebexHarvester] Access token refreshed');
  }

  /**
   * Fetch data from Webex
   */
  async fetchData(options = {}) {
    const {
      roomId,
      roomIds = [],
      dateRange,
      includeTranscripts = true,
      includeChat = true,
      includeRecordings = false,
      maxMessages = 1000
    } = options;

    const allData = [];

    // Determine which rooms to fetch from
    let rooms = [];
    if (roomId) {
      rooms = [roomId];
    } else if (roomIds.length > 0) {
      rooms = roomIds;
    } else {
      // Fetch recent rooms
      rooms = await this.fetchRecentRooms(dateRange);
    }

    for (const room of rooms) {
      console.log(`[WebexHarvester] Fetching data from room: ${room}`);

      // Fetch room details
      const roomDetails = await this.fetchRoomDetails(room);

      // Fetch messages/chat
      if (includeChat) {
        const messages = await this.fetchRoomMessages(room, {
          dateRange,
          maxMessages
        });
        allData.push({
          type: 'chat',
          room: roomDetails,
          messages
        });
      }

      // Fetch meeting transcripts
      if (includeTranscripts) {
        const transcripts = await this.fetchMeetingTranscripts(room, dateRange);
        allData.push(...transcripts.map(transcript => ({
          type: 'transcript',
          room: roomDetails,
          transcript
        })));
      }

      // Fetch recordings (if enabled and available)
      if (includeRecordings) {
        const recordings = await this.fetchMeetingRecordings(room, dateRange);
        allData.push(...recordings.map(recording => ({
          type: 'recording',
          room: roomDetails,
          recording
        })));
      }
    }

    return allData;
  }

  /**
   * Fetch recent rooms/spaces
   */
  async fetchRecentRooms(dateRange) {
    const params = new URLSearchParams({
      type: 'group', // Focus on group rooms (not 1:1)
      sortBy: 'lastActivity',
      max: 50
    });

    const response = await this.makeRequest(`${this.apiUrl}/rooms?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    const rooms = response.items || [];

    // Filter by date range if specified
    if (dateRange && dateRange.start) {
      const startDate = new Date(dateRange.start);
      return rooms.filter(room => {
        const lastActivity = new Date(room.lastActivity);
        return lastActivity >= startDate;
      });
    }

    return rooms.map(room => room.id);
  }

  /**
   * Fetch room details
   */
  async fetchRoomDetails(roomId) {
    const response = await this.makeRequest(`${this.apiUrl}/rooms/${roomId}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    return {
      id: response.id,
      title: response.title,
      type: response.type,
      created: response.created,
      lastActivity: response.lastActivity
    };
  }

  /**
   * Fetch messages from a room
   */
  async fetchRoomMessages(roomId, options = {}) {
    const { dateRange, maxMessages = 1000 } = options;
    const messages = [];

    const params = new URLSearchParams({
      roomId: roomId,
      max: Math.min(maxMessages, 1000).toString()
    });

    if (dateRange && dateRange.start) {
      params.append('before', new Date().toISOString());
      // Note: Webex API doesn't support 'after' parameter directly,
      // we'll filter in post-processing
    }

    const response = await this.makeRequest(`${this.apiUrl}/messages?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    const allMessages = response.items || [];

    // Filter by date range
    if (dateRange && dateRange.start) {
      const startDate = new Date(dateRange.start);
      const endDate = dateRange.end ? new Date(dateRange.end) : new Date();

      return allMessages.filter(msg => {
        const msgDate = new Date(msg.created);
        return msgDate >= startDate && msgDate <= endDate;
      });
    }

    return allMessages;
  }

  /**
   * Fetch meeting transcripts
   */
  async fetchMeetingTranscripts(roomId, dateRange) {
    // Note: Webex transcript API requires separate meeting IDs
    // This is a simplified version - in production, you'd need to:
    // 1. Fetch meetings associated with the room
    // 2. Get transcripts for each meeting

    const meetings = await this.fetchRoomMeetings(roomId, dateRange);
    const transcripts = [];

    for (const meeting of meetings) {
      if (meeting.transcriptUrl) {
        const transcript = await this.fetchTranscript(meeting.transcriptUrl);
        transcripts.push({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          startTime: meeting.start,
          endTime: meeting.end,
          content: transcript
        });
      }
    }

    return transcripts;
  }

  /**
   * Fetch meetings for a room
   */
  async fetchRoomMeetings(roomId, dateRange) {
    // This would typically use the Webex Meetings API
    // Simplified for this implementation

    const params = new URLSearchParams({
      roomId: roomId,
      max: 100
    });

    if (dateRange && dateRange.start) {
      params.append('from', dateRange.start);
    }
    if (dateRange && dateRange.end) {
      params.append('to', dateRange.end);
    }

    try {
      const response = await this.makeRequest(`${this.apiUrl}/meetings?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      return response.items || [];
    } catch (error) {
      console.log(`[WebexHarvester] Meeting fetch not available: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch transcript content
   */
  async fetchTranscript(transcriptUrl) {
    try {
      const response = await this.makeRequest(transcriptUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      return response;
    } catch (error) {
      console.log(`[WebexHarvester] Transcript fetch failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch meeting recordings
   */
  async fetchMeetingRecordings(roomId, dateRange) {
    // Note: Recordings require additional API permissions
    // and may need separate processing for transcription
    console.log('[WebexHarvester] Recording fetch not implemented in this version');
    return [];
  }

  /**
   * Transform Webex data to standard format
   */
  async transformData(rawData) {
    const transformed = [];

    for (const item of rawData) {
      if (item.type === 'chat') {
        // Transform chat messages
        const chatText = this.transformChatMessages(item.messages);
        if (chatText) {
          transformed.push({
            text: chatText,
            source: `webex:chat:${item.room.id}`,
            sourceType: 'chat_conversation',
            metadata: {
              roomId: item.room.id,
              roomTitle: item.room.title,
              messageCount: item.messages.length,
              dateRange: this.getMessageDateRange(item.messages)
            }
          });
        }
      } else if (item.type === 'transcript') {
        // Transform meeting transcript
        const transcriptText = this.transformTranscript(item.transcript);
        if (transcriptText) {
          transformed.push({
            text: transcriptText,
            source: `webex:transcript:${item.transcript.meetingId}`,
            sourceType: 'meeting_transcript',
            metadata: {
              roomId: item.room.id,
              roomTitle: item.room.title,
              meetingId: item.transcript.meetingId,
              meetingTitle: item.transcript.meetingTitle,
              startTime: item.transcript.startTime,
              endTime: item.transcript.endTime
            }
          });
        }
      }
    }

    return transformed;
  }

  /**
   * Transform chat messages to text
   */
  transformChatMessages(messages) {
    if (!messages || messages.length === 0) return null;

    const textParts = [];

    // Group messages by conversation threads
    const conversations = this.groupMessagesByConversation(messages);

    for (const conversation of conversations) {
      const convText = conversation.messages
        .map(msg => {
          const timestamp = new Date(msg.created).toLocaleString();
          const author = msg.personEmail || 'Unknown';
          const text = msg.text || msg.markdown || '';
          return `[${timestamp}] ${author}: ${text}`;
        })
        .join('\n');

      textParts.push(convText);
    }

    return textParts.join('\n\n---\n\n');
  }

  /**
   * Group messages into conversation threads
   */
  groupMessagesByConversation(messages) {
    // Simple grouping by time proximity (messages within 30 minutes)
    const conversations = [];
    let currentConversation = null;
    const timeThreshold = 30 * 60 * 1000; // 30 minutes

    for (const msg of messages) {
      const msgTime = new Date(msg.created).getTime();

      if (!currentConversation ||
          msgTime - currentConversation.lastTime > timeThreshold) {
        currentConversation = {
          startTime: msgTime,
          lastTime: msgTime,
          messages: [msg]
        };
        conversations.push(currentConversation);
      } else {
        currentConversation.messages.push(msg);
        currentConversation.lastTime = msgTime;
      }
    }

    return conversations;
  }

  /**
   * Transform transcript to text
   */
  transformTranscript(transcript) {
    if (!transcript || !transcript.content) return null;

    // If content is already text
    if (typeof transcript.content === 'string') {
      return `Meeting: ${transcript.meetingTitle || 'Untitled'}\n\n${transcript.content}`;
    }

    // If content is structured (speaker + text)
    if (Array.isArray(transcript.content)) {
      const lines = transcript.content.map(entry => {
        const speaker = entry.speaker || 'Speaker';
        const text = entry.text || '';
        const time = entry.time ? `[${entry.time}]` : '';
        return `${time} ${speaker}: ${text}`;
      });

      return `Meeting: ${transcript.meetingTitle || 'Untitled'}\n\n${lines.join('\n')}`;
    }

    return null;
  }

  /**
   * Get date range from messages
   */
  getMessageDateRange(messages) {
    if (!messages || messages.length === 0) return null;

    const dates = messages.map(msg => new Date(msg.created).getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    return {
      start: minDate.toISOString(),
      end: maxDate.toISOString()
    };
  }

  /**
   * Test Webex connection
   */
  async testConnection() {
    try {
      await this.authenticate();

      // Fetch user info to verify connection
      const user = await this.makeRequest(`${this.apiUrl}/people/me`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      return {
        success: true,
        message: `Successfully connected to Webex as ${user.displayName}`,
        userEmail: user.emails[0]
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get available rooms for configuration UI
   */
  async getAvailableRooms() {
    await this.authenticate();

    const params = new URLSearchParams({
      type: 'group',
      sortBy: 'lastActivity',
      max: 100
    });

    const response = await this.makeRequest(`${this.apiUrl}/rooms?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    return (response.items || []).map(room => ({
      id: room.id,
      title: room.title,
      type: room.type,
      lastActivity: room.lastActivity,
      created: room.created
    }));
  }
}

module.exports = WebexHarvester;