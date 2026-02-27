// Dummy script to generate dummy reportage data to test
const dummyData = [
    {
        id: 1,
        image: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1170&q=80',
        desc: 'Un intenso reportage sulle strade di New York.',
        date: '2023-10-15',
        location: 'New York, Street Life',
        comments: [
            { name: 'Mario', text: 'Scatti bellissimi!' }
        ]
    }
];
localStorage.setItem('fotografia_blog_data', JSON.stringify(dummyData));
window.location.reload();
