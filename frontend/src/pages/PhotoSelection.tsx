import { useState } from 'react';
import axios from 'axios';
import ActorCardComponent from '../components/ActorCardComponent';
import { useParams, useNavigate } from 'react-router-dom';

const PhotoSelection = () => {
    const [searchResults, setSearchResults] = useState<{ path: string }[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const { username } = useParams();
    const navigate = useNavigate();

    const rootURL = import.meta.env.VITE_API_URL;

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            setError('Please select an image to upload.');
            return;
        }

        const formData = new FormData();
        formData.append('image', selectedFile);
        setIsLoading(true);

        try {
            console.log('Sending upload request...');
            const response = await axios.post(`${rootURL}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                withCredentials: true,
            });

            console.log('Upload response:', response.data);

            // check for key
            if (!response.data.key) {
                console.error('No key in response data');
                setError('No image key received from server');
                setIsLoading(false);
                return;
            }

            const embedding = response.data.embedding;
            const key = response.data.key;
            console.log('Embedding:', embedding);
            console.log('S3 Key:', key);

            // Save the selfie key to the user's profile
            try {
                console.log('Saving selfie to user profile...');
                const saveResponse = await axios.post(
                    `${rootURL}/saveUserSelfie`,
                    { image_path: key },
                    { withCredentials: true }
                );
                console.log('Save selfie response:', saveResponse.data);
                setUploadSuccess(true);
            } catch (saveErr: any) {
                console.error('Error saving selfie:', saveErr);
                console.error('Save error details:', saveErr.response ? saveErr.response.data : saveErr.message);
            }

            await findMatches(embedding);
        } catch (err: any) {
            console.error('Upload error:', err);
            console.error('Error details:', err.response ? err.response.data : err.message);
            setError(err.response ? err.response.data.error : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const findMatches = async (embedding) => {
        try {
            console.log('Finding matches for embedding...');
            const response = await axios.post(`${rootURL}/match`, { embedding });
            console.log('Match response:', response.data);
            setSearchResults(response.data);
            setError('');
        } catch (err: any) {
            console.error('Match error:', err);
            setSearchResults([]);
            setError(err.response ? err.response.data.error : 'An error occurred');
        }
    };

    const handleSelectPhoto = async (img_path) => {
        try {
            const response = await axios.post(`${rootURL}/${username}/selectPhoto`, { image_path: img_path }, { withCredentials: true });
            if (response.status === 200) {
                console.log('Photo selected successfully:', response.data);
                navigate(`/${username}/home`);
            } else {
                console.error('Error selecting photo:', response.data);
            }
        } catch (err: any) {
            setError(err.response ? err.response.data.error : 'An error occurred');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-6">
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-8">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Photo Selection</h1>

                {/* Upload Section */}
                <div className="flex flex-col gap-4 mb-8">
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="p-2 text-sm border border-gray-300 rounded"
                    />
                    <button
                        onClick={handleUpload}
                        disabled={isLoading}
                        className={`py-3 text-white font-semibold rounded transition ${isLoading
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600'
                            }`}
                    >
                        {isLoading ? 'Uploading...' : 'Upload Photo'}
                    </button>
                    {uploadSuccess && (
                        <p className="text-green-600 text-sm">Selfie saved to your profile!</p>
                    )}
                    {error && (
                        <p className="text-red-500 text-sm">{error}</p>
                    )}
                </div>

                {/* Actor Match Section */}
                {searchResults.length > 0 && (
                    <div>
                        <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">
                            Select Your Profile Photo
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                            {searchResults.map((img, idx) => (
                                <div key={idx} className="relative rounded-lg overflow-hidden shadow-md">
                                    <ActorCardComponent imagePath={img} />
                                    <button
                                        onClick={() => handleSelectPhoto(img.path)}
                                        className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium py-1 px-3 rounded shadow"
                                    >
                                        Select Photo
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

};

export default PhotoSelection;