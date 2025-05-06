import React, { useState, useEffect } from 'react';
import axios from 'axios';
import config from '../../config.json';
import ActorCardComponent from '../components/ActorCardComponent';
import { useParams, useNavigate } from 'react-router-dom';
import { FiHome, FiMessageCircle, FiSearch, FiUsers, FiPlusSquare, FiLogOut, FiUser } from 'react-icons/fi';
import { getSocket } from "../Socket";
import Sidebar from '../components/Sidebar';

interface UserProfile {
    user_id: number;
    username: string;
    selfie_photo: string;
    profile_photo: string;
    linked_nconst: string;
    first_name: string;
    last_name: string;
    email: string;
    affiliation: string;
    birthday: string;
    hashtags: string;
}

const Profile = () => {
    const [profileData, setProfileData] = useState<UserProfile | null>(null);
    const [searchResults, setSearchResults] = useState([]);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [hashtags, setHashtags] = useState('');
    const [selectedHashtags, setSelectedHashtags] = useState([]);
    const [popularHashtags, setPopularHashtags] = useState([]);
    const [hashtagsUpdateSuccess, setHashtagsUpdateSuccess] = useState(false);
    const { username } = useParams();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [emailUpdateSuccess, setEmailUpdateSuccess] = useState(false);
    const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const rootURL = config.serverRootURL;

    // get popular hashtags for recommendation
    useEffect(() => {
        const fetchPopularHashtags = async () => {
            try {
                const response = await axios.get(`${rootURL}/popularHashtags`);
                setPopularHashtags(response.data.hashtags.slice(0, 10));
            } catch (error) {
                console.error('Error fetching popular hashtags:', error);
            }
        };

        fetchPopularHashtags();
    }, [rootURL]);

    // profile data fetch on loading
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await axios.get(`${rootURL}/${username}/profile`, { withCredentials: true });
                setProfileData(response.data);

                // Set email from profile data
                if (response.data.email) {
                    setEmail(response.data.email);
                }

                // get hashtags from profile data
                if (response.data.hashtags) {
                    const hashtagsString = response.data.hashtags;
                    console.log('Fetched hashtags:', hashtagsString);
                    setHashtags(hashtagsString);

                    // split and clean
                    const hashtagArray = hashtagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                    console.log('Parsed hashtags array:', hashtagArray);
                    setSelectedHashtags(hashtagArray);
                }

                // get embedding from selfie and find matches initially
                if (response.data.selfie_photo) {
                    await fetchEmbeddingAndFindMatches(response.data.selfie_photo);
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
                setError(err.response?.data?.error || 'An error occurred');
            }
        };

        fetchProfile();
    }, [username, rootURL]);

    const updateEmail = async () => {
        try {
            setIsLoading(true);
            setEmailError(null);

            const response = await axios.post(
                `${rootURL}/${username}/updateEmail`,
                { email },
                { withCredentials: true }
            );

            if (response.status === 200) {
                setEmailUpdateSuccess(true);
                setProfileData(prev => {
                    if (prev) {
                        return { ...prev, email: email };
                    }
                    return prev;
                });

                setTimeout(() => {
                    setEmailUpdateSuccess(false);
                }, 3000);
            }
        } catch (err) {
            console.error('Error updating email:', err);
            setEmailError(err.response?.data?.error || 'Failed to update email');
        } finally {
            setIsLoading(false);
        }
    };

    const updatePassword = async () => {
        try {
            setIsLoading(true);
            setPasswordError(null);

            if (!currentPassword || !newPassword) {
                setPasswordError('Both current password and new password are required');
                setIsLoading(false);
                return;
            }

            const response = await axios.post(
                `${rootURL}/${username}/updatePassword`,
                {
                    current_password: currentPassword,
                    new_password: newPassword
                },
                { withCredentials: true }
            );

            if (response.status === 200) {
                setPasswordUpdateSuccess(true);
                setCurrentPassword('');
                setNewPassword('');

                setTimeout(() => {
                    setPasswordUpdateSuccess(false);
                }, 3000);
            }
        } catch (err) {
            console.error('Error updating password:', err);
            setPasswordError(err.response?.data?.error || 'Failed to update password');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleHashtag = (tag) => {
        const isSelected = selectedHashtags.includes(tag);

        if (isSelected) {
            setSelectedHashtags(selectedHashtags.filter(t => t !== tag));
        } else {
            setSelectedHashtags([...selectedHashtags, tag]);
        }
    };

    // update hashtags string when selected hashtags change
    useEffect(() => {
        setHashtags(selectedHashtags.join(','));
    }, [selectedHashtags]);

    // update user hashtags
    const updateHashtags = async () => {
        try {
            setIsLoading(true);
            const response = await axios.post(
                `${rootURL}/${username}/updateHashtags`,
                { hashtags: hashtags },
                { withCredentials: true }
            );

            if (response.status === 200) {
                setHashtagsUpdateSuccess(true);
                // update profile data
                setProfileData(prev => {
                    if (prev) {
                        return { ...prev, hashtags: hashtags };
                    }
                    return prev;
                });

                // reset success message after 3 seconds
                setTimeout(() => {
                    setHashtagsUpdateSuccess(false);
                }, 3000);
            }
        } catch (err) {
            console.error('Error updating hashtags:', err);
            setError(err.response?.data?.error || 'Failed to update hashtags');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchEmbeddingAndFindMatches = async (selfieKey) => {
        try {
            // get selfie embedding
            const embeddingResponse = await axios.post(
                `${rootURL}/getEmbeddingFromSelfieKey`,
                { key: selfieKey },
                { withCredentials: true }
            );

            if (embeddingResponse.data && embeddingResponse.data.embedding) {
                await findMatches(embeddingResponse.data.embedding);
            } else {
                console.error('Could not get embedding for selfie');
            }
        } catch (err) {
            console.error('Error getting embedding for selfie:', err);
        }
    };

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

            try {
                console.log('Saving selfie to user profile...');
                const saveResponse = await axios.post(
                    `${rootURL}/saveUserSelfie`,
                    { image_path: key },
                    { withCredentials: true }
                );
                console.log('Save selfie response:', saveResponse.data);
                setUploadSuccess(true);

                // Update profile data with new selfie
                setProfileData(prev => {
                    if (prev) {
                        return { ...prev, selfie_photo: key };
                    }
                    return prev;
                });
            } catch (saveErr) {
                console.error('Error saving selfie:', saveErr);
                console.error('Save error details:', saveErr.response ? saveErr.response.data : saveErr.message);
            }

            await findMatches(embedding);
        } catch (err) {
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
        } catch (err) {
            console.error('Match error:', err);
            setSearchResults([]);
            setError(err.response ? err.response.data.error : 'An error occurred');
        }
    };

    const handleSelectPhoto = async (img) => {
        try {
            const response = await axios.post(
                `${rootURL}/${username}/selectPhoto`,
                {
                    image_path: img.path,
                    actor_name: img.name
                },
                { withCredentials: true }
            );

            if (response.status === 200) {
                console.log('Photo selected successfully:', response.data);
                // update profile photo
                setProfileData(prev => {
                    if (prev) {
                        return { ...prev, profile_photo: img.path };
                    }
                    return prev;
                });
            } else {
                console.error('Error selecting photo:', response.data);
            }
        } catch (err) {
            setError(err.response ? err.response.data.error : 'An error occurred');
        }
    };

    return (
        <div className='w-screen h-screen flex flex-row'>
            {/* sidebar same */}
            <Sidebar />

            {/* frontend yay */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-white flex items-center justify-center border-b shadow-sm flex-shrink-0">
                    <span className="text-2xl font-medium">{`Profile`}</span>
                </header>

                <div className="overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="p-6">
                            {profileData ? (
                                <div className="space-y-8">
                                    {/* info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <h2 className="text-xl font-semibold">User Information</h2>
                                            <p><span className="font-medium">Name:</span> {profileData.first_name} {profileData.last_name}</p>
                                            <p><span className="font-medium">Username:</span> {profileData.username}</p>
                                            <p><span className="font-medium">Email:</span> {profileData.email}</p>
                                            <p><span className="font-medium">Affiliation:</span> {profileData.affiliation}</p>
                                            <p><span className="font-medium">Birthday:</span> {new Date(profileData.birthday).toLocaleDateString()}</p>
                                        </div>

                                        {/* Profile photo section */}
                                        <div className="space-y-4">
                                            <h2 className="text-xl font-semibold">Actor Photo</h2>
                                            {profileData.profile_photo && (
                                                <div className="w-48 h-48 mx-auto rounded-full overflow-hidden border-4">
                                                    <img
                                                        src={`https://nets2120-images.s3.amazonaws.com/${profileData.profile_photo}`}
                                                        alt="Profile"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* change email and password */}
                                    <div className="mt-8 border-t pt-8">
                                        <h2 className="text-xl font-semibold mb-4">Update Profile Information</h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Email Update */}
                                            <div className="space-y-4">
                                                <h3 className="text-lg font-medium">Update Email</h3>
                                                <div className="border p-3 rounded-md bg-gray-50">
                                                    <input
                                                        id="email"
                                                        type="email"
                                                        placeholder="Enter new email address"
                                                        className="w-full p-3 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                    />

                                                    <button
                                                        onClick={updateEmail}
                                                        disabled={isLoading}
                                                        className="mt-3 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded"
                                                    >
                                                        {isLoading ? 'Updating...' : 'Update Email'}
                                                    </button>

                                                    {emailUpdateSuccess && (
                                                        <p className="text-green-500 text-sm mt-2">Email updated successfully!</p>
                                                    )}
                                                    {emailError && (
                                                        <p className="text-red-500 text-sm mt-2">{emailError}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Password Update */}
                                            <div className="space-y-4">
                                                <h3 className="text-lg font-medium">Update Password</h3>
                                                <div className="border p-3 rounded-md bg-gray-50">
                                                    <input
                                                        id="currentPassword"
                                                        type="password"
                                                        placeholder="Current password"
                                                        className="w-full p-3 mb-3 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                        value={currentPassword}
                                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                                    />

                                                    <input
                                                        id="newPassword"
                                                        type="password"
                                                        placeholder="New password"
                                                        className="w-full p-3 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                    />

                                                    <button
                                                        onClick={updatePassword}
                                                        disabled={isLoading}
                                                        className="mt-3 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded"
                                                    >
                                                        {isLoading ? 'Updating...' : 'Update Password'}
                                                    </button>

                                                    {passwordUpdateSuccess && (
                                                        <p className="text-green-500 text-sm mt-2">Password updated successfully!</p>
                                                    )}
                                                    {passwordError && (
                                                        <p className="text-red-500 text-sm mt-2">{passwordError}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hashtags section */}
                                    <div className="mt-8 border-t pt-8">
                                        <h2 className="text-xl font-semibold mb-4">Your Interests</h2>
                                        <div className="space-y-4">
                                            <div className="border p-3 rounded-md bg-gray-50">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Current interests: {profileData.hashtags}
                                                </label>

                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {popularHashtags.map((item, index) => (
                                                        <button
                                                            key={index}
                                                            type="button"
                                                            onClick={() => toggleHashtag(item.tag)}
                                                            className={`text-sm px-3 py-1 rounded-full ${selectedHashtags.includes(item.tag)
                                                                    ? 'bg-pink-500 text-white'
                                                                    : 'bg-gray-200 text-gray-800'
                                                                }`}
                                                        >
                                                            #{item.tag}
                                                        </button>
                                                    ))}
                                                </div>

                                                <input
                                                    id="hashtags"
                                                    type="text"
                                                    placeholder="Enter interests (comma-separated)"
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-400"
                                                    value={hashtags}
                                                    onChange={(e) => setHashtags(e.target.value)}
                                                />

                                                <button
                                                    onClick={updateHashtags}
                                                    disabled={isLoading}
                                                    className="mt-3 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded"
                                                >
                                                    {isLoading ? 'Updating...' : 'Update Interests'}
                                                </button>

                                                {hashtagsUpdateSuccess && (
                                                    <p className="text-green-500 text-sm mt-2">Interests updated successfully!</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Selfie */}
                                    <div className="mt-8 border-t pt-8">
                                        <h2 className="text-xl font-semibold mb-4">Your Selfie</h2>

                                        <div className="flex flex-col md:flex-row gap-8">
                                            <div className="md:w-1/3">
                                                {profileData.selfie_photo ? (
                                                    <div className="mb-4">
                                                        <img
                                                            src={`https://nets2120-chroma-wahoo.s3.amazonaws.com/${profileData.selfie_photo}`}
                                                            alt="User Selfie"
                                                            className="w-48 h-48 object-cover rounded-lg border-2 border-gray-300 mx-auto"
                                                        />
                                                        <p className="text-sm text-gray-500 mt-2 text-center">Current selfie</p>
                                                    </div>
                                                ) : (
                                                    <p className="text-gray-500 mb-4">No selfie uploaded yet.</p>
                                                )}

                                                <div className="space-y-3">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleFileChange}
                                                        className="w-full border border-gray-300 rounded p-2"
                                                    />
                                                    <button
                                                        onClick={handleUpload}
                                                        disabled={isLoading}
                                                        className={`w-full py-2 px-4 rounded ${isLoading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white font-medium`}
                                                    >
                                                        {isLoading ? 'Uploading...' : 'Upload New Selfie'}
                                                    </button>
                                                    {uploadSuccess && (
                                                        <p className="text-green-500 text-sm">Selfie updated successfully!</p>
                                                    )}
                                                    {error && (
                                                        <p className="text-red-500 text-sm">{error}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* actor matches */}
                                            {searchResults.length > 0 && (
                                                <div className="md:w-2/3">
                                                    <h3 className="text-lg font-medium mb-3">Select Your Actor Match</h3>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                        {searchResults.map((img, idx) => (
                                                            <div key={idx} className="relative">
                                                                <ActorCardComponent imagePath={img} />
                                                                <div className="mt-2 text-sm text-center font-medium">{img.name}</div>
                                                                <button
                                                                    onClick={() => handleSelectPhoto(img)}
                                                                    className="mt-2 w-full py-1 px-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded"
                                                                >
                                                                    Select
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-500">Loading profile data...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
