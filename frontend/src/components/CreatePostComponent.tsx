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
    <div className="w-screen h-screen flex justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-center font-semibold text-xl tracking-wide">New post</h2>

        {/* Caption */}
        <div className="flex flex-col space-y-2">
          <label htmlFor="content" className="text-sm font-medium text-gray-700">Caption</label>
          <textarea
            id="content"
            placeholder="Write a caption..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full resize-none border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={3}
            maxLength={2200}
            required
          />
          <span className="self-end text-xs text-gray-400">{content.length}/2,200</span>
        </div>

        {/* Hashtags */}
        <div className="flex flex-col space-y-2">
          <label htmlFor="hashtags" className="text-sm font-medium text-gray-700">Hashtags (comma separated)</label>
          <input
            id="hashtags"
            type="text"
            placeholder="travel,photography,foodie"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            className="border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Image */}
        <div className="flex flex-col space-y-2">
          <label htmlFor="image" className="text-sm font-medium text-gray-700">Image (optional)</label>
          <input
            id="image"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-600 file:to-pink-500 file:text-white hover:file:opacity-90"
          />
        </div>

        {/* Preview */}
        {previewUrl && (
          <div className="w-full aspect-square overflow-hidden rounded-lg border border-gray-200">
            <img
              src={previewUrl}
              alt="Image preview"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="w-full py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-pink-300 transition"
        >
          Share
        </button>
      </form>
    </div>
  );
}

export default CreatePostComponent;
