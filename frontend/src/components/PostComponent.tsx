import React, { useMemo, useState } from 'react'
import { FiHeart, FiCornerUpLeft } from 'react-icons/fi';


interface Comment {
    username: string
    comment_id: number
    parent_id: number  // top-level comments use -1
    text_content: string
}

export default function PostComponent({
    onLike,
    onComment,
    user = 'arnavchopra',
    hashtags = 'iamhavingsomuchfun, aaaaa',
    likes = 0,
    comments = [],
    text = 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Rem porro consequatur impedit dolor, soluta rerum mollitia ut eos fugiat! Amet nam voluptate quos delectus rem enim veritatis eius iste! Et.',
    imageUrl = ''
}: {
    onLike: () => void,
    onComment: (parentIndex: number, text: string) => void,
    user: string,
    hashtags?: string,
    likes: number,
    comments: Comment[],
    text: string,
    imageUrl?: string;
}) {
    const [commentText, setCommentText] = useState<string>('');
    const [replyToId, setReplyToId] = useState<number | null>(null)
    const [replyText, setReplyText] = useState('')


    // Build nested comment structure
    const nestedComments = useMemo(() => {
        const map = new Map<number, Comment & { replies: any[] }>()
        comments.forEach(c => map.set(c.comment_id, { ...c, replies: [] }))
        const roots: (Comment & { replies: any[] })[] = []

        map.forEach(c => {
            if (c.parent_id !== -1 && map.has(c.parent_id)) {
                map.get(c.parent_id)!.replies.push(c)
            } else {
                roots.push(c)
            }
        })

        return roots
    }, [comments])


    const renderComments = (
        list: (Comment & { replies: any[] })[],
        level = 0
    ): React.ReactNode => {
        return list.map(c => (
            <div key={c.comment_id} className="space-y-1" style={{ marginLeft: level * 16 }}>
                <div className="flex items-center space-x-2">
                    <span className="font-semibold">{c.username}</span>
                    <span>{c.text_content}</span>
                    <button
                        className="ml-auto focus:outline-none"
                        onClick={() => setReplyToId(replyToId === c.comment_id ? null : c.comment_id)}
                    >
                        <FiCornerUpLeft size={16} />
                    </button>
                </div>

                {replyToId === c.comment_id && (
                    <div className="ml-6 flex items-center space-x-2">
                        <input
                            type="text"
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1 text-sm focus:outline-none border-b border-gray-300 pb-1"
                        />
                        <button
                            onClick={() => {
                                onComment(c.comment_id, replyText)
                                setReplyText('')
                                setReplyToId(null)
                            }}
                            className="font-semibold text-blue-500 disabled:opacity-50"
                            disabled={!replyText.trim()}
                        >
                            Reply
                        </button>
                    </div>
                )}

                {c.replies.length > 0 && renderComments(c.replies, level + 1)}
            </div>
        ))
    }


    return (
        <div className="bg-white border border-gray-300 rounded-md w-full max-w-[600px] mx-auto space-y-3 my-5">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="font-semibold text-sm uppercase">{user.charAt(0)}</span>
                    </div>
                    <span className="font-semibold text-sm">{user}</span>
                </div>
            </div>

            {/* Image */}
            {imageUrl && (
                <div className="w-full">
                    <img
                        src={imageUrl}
                        alt="Post attachment"
                        className="w-full object-cover max-h-[600px]"
                    />
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center space-x-4">
                    <button onClick={onLike}><FiHeart size={24} /></button>
                </div>
            </div>

            {/* Likes */}
            <div className="px-4">
                <span className="font-semibold text-sm">{likes} likes</span>
            </div>

            {/* Caption */}
            <div className="px-4 text-sm">
                <span className="font-semibold">{user} </span>{text}
            </div>

            <div>
                {hashtags && (
                    <div className="px-4 text-sm text-blue-500 flex flex-wrap space-x-2">
                        {hashtags.split(',').map((tag, idx) => (
                            <span key={idx}>#{tag.trim()}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* Comments Section */}
            <div className="px-4 text-sm font-semibold">Comments</div>
            <div className="px-4 text-sm space-y-2">
                {renderComments(nestedComments)}
            </div>

            {/* Add Comment */}
            <div className="border-t border-gray-200 px-4 py-2 flex items-center">
                <input
                    type="text"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    className="flex-1 text-sm focus:outline-none"
                    placeholder="Add a comment..."
                />
                <button
                    onClick={() => {
                        onComment(-1, commentText)
                        setCommentText('')
                    }}
                    className="font-semibold text-blue-500 px-2 disabled:opacity-50"
                    disabled={!commentText.trim()}
                >
                    Post
                </button>
            </div>
        </div>
    )
}
