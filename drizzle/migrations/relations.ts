import { relations } from "drizzle-orm/relations";
import { user, chat, customInstructions, extremeSearchUsage, message, messageUsage, session, stream, subscription, account } from "./schema";

export const chatRelations = relations(chat, ({one, many}) => ({
	user: one(user, {
		fields: [chat.userId],
		references: [user.id]
	}),
	messages: many(message),
	streams: many(stream),
}));

export const userRelations = relations(user, ({many}) => ({
	chats: many(chat),
	customInstructions: many(customInstructions),
	extremeSearchUsages: many(extremeSearchUsage),
	messageUsages: many(messageUsage),
	sessions: many(session),
	subscriptions: many(subscription),
	accounts: many(account),
}));

export const customInstructionsRelations = relations(customInstructions, ({one}) => ({
	user: one(user, {
		fields: [customInstructions.userId],
		references: [user.id]
	}),
}));

export const extremeSearchUsageRelations = relations(extremeSearchUsage, ({one}) => ({
	user: one(user, {
		fields: [extremeSearchUsage.userId],
		references: [user.id]
	}),
}));

export const messageRelations = relations(message, ({one}) => ({
	chat: one(chat, {
		fields: [message.chatId],
		references: [chat.id]
	}),
}));

export const messageUsageRelations = relations(messageUsage, ({one}) => ({
	user: one(user, {
		fields: [messageUsage.userId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const streamRelations = relations(stream, ({one}) => ({
	chat: one(chat, {
		fields: [stream.chatId],
		references: [chat.id]
	}),
}));

export const subscriptionRelations = relations(subscription, ({one}) => ({
	user: one(user, {
		fields: [subscription.userId],
		references: [user.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));