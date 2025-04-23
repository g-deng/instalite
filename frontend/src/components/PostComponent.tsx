import React from 'react'

export default function PostComponent({
    onLike,
    onComment,
    weight = '0',
    user = 'arnavchopra',
    hashtags = 'iamhavingsomuchfun, aaaaa',
    likes = '0',
    comments = [],
    text = 'Lorem ipsum dolor sit amet consectetur adipisicing elit. Rem porro consequatur impedit dolor, soluta rerum mollitia ut eos fugiat! Amet nam voluptate quos delectus rem enim veritatis eius iste! Et.'
}: {
    onLike: () => void,
    onComment: () => void,
    user: string,
    hashtags: string
    likes: number,
    comments: any[]
    text: string
}) {
    const [commentText, setCommentText] = React.useState<string>('');

    return (
        <div className='rounded-md bg-slate-50 w-full max-w-[1000px] space-y-2 p-3'>
            <div className=' text-slate-800'>
                <span className='font-semibold'> @{user} </span>
                posted
            </div>
            <div className=''>
                {text}
            </div>
            <div className='text-slate-500 text-sm'>
                {Math.round(weight * 1000) / 1000} ranked post recommendation
            </div>
            <div className='text-slate-500 text-sm'>
                {hashtags?.split(',').map((tag, index) => (
                    <span key={index} className='text-blue-500'> #{tag} </span>
                ))}
            </div>
            <div className='text-slate-500 text-sm'>
                <button onClick={onLike}>{likes} likes</button>
            </div>
            <div className='text-slate-500 text-sm'>
                {comments.length} comments
            </div>
            <div className='text-slate-500 text-sm'>
                {comments.map((comment, index) => (
                    <div key={index} className='flex space-x-2'>
                        <span className='font-semibold'> @{comment['username']} </span>
                        <span>{comment['text_content']}</span>
                    </div>
                ))}
            </div>
            <div className='flex space-x-2'>
                <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} className='border border-slate-300 rounded-md p-1' placeholder='Add a comment...' />
                <button onClick={() => { onComment(commentText); setCommentText(''); }} className='bg-blue-500 text-white rounded-md px-2'>Comment</button>
            </div>
        </div>
    )
}
