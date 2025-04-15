import React, { useState } from 'react';

const SearchForm = ({ onSearch }) => {
    const [name, setName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSearch({ name });
    };

    return (
        <form onSubmit={handleSubmit} className="search-form">
            <input
                type="text"
                placeholder="Actor Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <button type="submit">Search</button>
        </form>
    );
};

export default SearchForm;