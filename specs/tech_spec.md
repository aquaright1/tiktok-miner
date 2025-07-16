Shadow Bee is a agentic recruiter that would help company find the best technical talents on internet. (This could be integration with github, linkedin, etc)

For the first MVP lets focus on finding the best talents based on their github contribution. This is a employer facing product, i.e. our user would be employer

# Core Features

1. Employer can upload their JD
    1. analyze JD and derive - what are some skills / tech stack needed
2. Based on the skills / techstack we can leverage couple features / api on github
    1. https://github.com/trending - This is where we can gather all of the popular project repositories, analyze if any popular project could have a **good match** (the required skills / tech stack has similarity with our JD, or if the project is vibing with company’s mission)
        1. For each matched project, find all top contributors to that project, dig into their github profile
            1. For each github profile, store related information under candidate entity. Including, github handle, their socials, descriptions, what are some other projects they worked on etc…
    2. https://github.com/trending/developers
        1. Based on language / tech stack find top developers
            1. For each developer find their contributed projects featured as popular repo. 
            2. Analyze their project if there’s any good match to our analyzed JD.
3. After step 2, we already have collections of candidates (developers) each associated with one or more (one to many) significant projects that matched our JD.
4. Create a list view on all potential candidates that considered as good match and rank based on their match score.
5. User can batch generate cold reach / message. 
    1. Find how we can reach out to them, email, socials, etc
    2. For each selected candidate craft a cold reach email / message to each of the candidate.
    3. Make sure the message is personalized on what they’ve been working so far and how they could build something more exciting in their next role aligned to the JD. (Lure and excite candidate to give it a try)

# Key Entities

1. Job Description - Employer need to put in job description, later we will use LLM to analyze what are some of the key skills / tag
2. Candidate - We should gather all of their information on github
3. Projects - Github repo / project they worked on

As of now we want to focus on integrating with github.

# Match Algorithm

Please be creative here for matching algorithm to quantify **good match.** You should comeup with different match score defination / ranking algorithm so user can rank potential candidate based on 

- different ranking criteria
- different matching score definition

# Tech Stack

We would love to keep everything simple and up to date. 

- Typescript
- React
- Shadcn
- NextJS
- Python
    - Less prefered, use it if you need anything for scripting or for AI.
- Prisma
    - If need ORM or schema
- Supabase