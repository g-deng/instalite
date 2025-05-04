import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../../config.json';
import { useParams } from 'react-router-dom';

function CreatePostComponent({ updatePosts }) {
  const [hashtags, setHashtags] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { username } = useParams();

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);


  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('text_content', content);
    if (hashtags.trim()) {
      // backend expects comma-separated list
      formData.append('hashtags', hashtags.trim());
    }
    if (imageFile) {
      formData.append('image', imageFile);
    }
    try {
      /*
      const response = await axios.post(`${config.serverRootURL}/${username}/createPost`, {
        title,
        text_content: content,
      }, {withCredentials: true });
      */
      const response = await axios.post(
        `${config.serverRootURL}/${username}/createPost`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          withCredentials: true,
        }
      );
      console.log(response);
      if (response.status === 201 || response.status === 200) {
        setContent('');
        setHashtags('');
        setImageFile(null);
        setPreviewUrl(null);
        updatePosts();
      }
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  return (
    <div className='w-screen h-screen flex justify-center'>
    <form>
      <div className='rounded-md bg-slate-50 p-6 space-y-2 w-full'>
        <div className='font-bold flex w-full justify-center text-2xl mb-4'>
          Create Post
        </div>
        <div className='flex space-x-4 items-center justify-between'>
          <label htmlFor="content" className='font-semibold'>Caption</label>
          {/* <input id="content" type="text" className='outline-none bg-white rounded-md border border-slate-100 p-2'
            value={content} onChange={(e) => setContent(e.target.value)} /> */}
            <textarea
          placeholder="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="border border-gray-300 p-2 rounded-md mb-2"
          rows={4}
          required
        ></textarea>
        </div>
        <div className="flex flex-col">
            <label htmlFor="hashtags" className="font-semibold mb-1">Hashtags (comma-separated)</label>
            <input
              id="hashtags"
              type="text"
              placeholder="e.g. travel,photography,foodie"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              className="border border-gray-300 p-2 rounded-md"
            />
          </div>
        <div className="flex flex-col">
            <label htmlFor="image" className="font-semibold mb-1">Image (optional)</label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
          </div>
          {previewUrl && (
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt="Image Preview"
                className="max-h-48 rounded-md border border-gray-200 mt-2"
              />
            </div>
          )}
        <div className='w-full flex justify-center'>
          <button type="button" className='px-4 py-2 rounded-md bg-indigo-500 outline-none font-bold text-white'
            onClick={handleSubmit}>Create Post</button>
        </div>
      </div>
    </form>
  </div>

   


  );
}

export default CreatePostComponent;
