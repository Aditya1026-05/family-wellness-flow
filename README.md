# CareCircle Connect

Build a complete production-quality frontend for a product called CareCircle.

IMPORTANT:

This application must support BOTH:

1. Mobile App Experience (Primary)

2. Desktop/Web Dashboard Experience

Use a responsive design system that automatically adapts between mobile and desktop layouts.

Technology:

- React

- TypeScript

- Tailwind CSS

- Shadcn UI

- React Router

- TanStack Query

- Zustand

- Responsive Design

- Component-based architecture

Use mock APIs and mock data for now.

--------------------------------------------------

PRODUCT OVERVIEW

--------------------------------------------------

CareCircle is a family care coordination platform that helps adult children remotely manage daily routines for elderly parents.

The goal is to make caregiving simple.

The child manages everything.

The parent only needs to acknowledge and complete tasks.

Examples of tasks:

- Breakfast

- Lunch

- Dinner

- Medicines

- Exercise

- Walking

- Water intake

- Doctor appointments

The application has two completely different user experiences:

1. Child Experience

2. Parent Experience

--------------------------------------------------

DESIGN PHILOSOPHY

--------------------------------------------------

The UI should feel:

- Warm

- Trustworthy

- Modern

- Family-oriented

- Extremely easy to use

DO NOT make it look like:

- Hospital software

- Medical record software

- Enterprise dashboard

Use:

- Large cards

- Rounded corners

- Plenty of spacing

- Clean typography

- Soft shadows

- Minimal clutter

Think:

Apple Health + Notion simplicity + Calm design language.

--------------------------------------------------

COLOR SYSTEM

--------------------------------------------------

Primary:

#2563EB

Success:

#16A34A

Warning:

#F59E0B

Danger:

#DC2626

Background:

#F8FAFC

Card:

#FFFFFF

Text:

#0F172A

--------------------------------------------------

ROLES

--------------------------------------------------

Role 1:

Child

Role 2:

Parent

--------------------------------------------------

AUTHENTICATION FLOW

--------------------------------------------------

Landing Page

Logo

App Name:

CareCircle

Tagline:

Helping families care from anywhere.

Buttons:

[I Am A Child]

[I Am A Parent]

--------------------------------------------------

CHILD AUTHENTICATION

--------------------------------------------------

Login Screen

Fields:

Email

Password

Buttons:

Login

Create Account

--------------------------------------------------

Registration Screen

Fields:

Name

Email

Password

Confirm Password

Button:

Create Account

--------------------------------------------------

PARENT ONBOARDING

--------------------------------------------------

Parent clicks:

I Am A Parent

Show:

Scan QR Code

Large centered QR scanner UI.

After scan:

Welcome Screen

Display:

Welcome, Mom

or

Welcome, Dad

Button:

Continue

--------------------------------------------------

CHILD EXPERIENCE

--------------------------------------------------

Desktop:

Use left sidebar navigation.

Mobile:

Use bottom navigation.

Navigation Items:

Dashboard

Parents

Tasks

Alerts

Profile

--------------------------------------------------

CHILD DASHBOARD

--------------------------------------------------

Show:

Family Summary Card

Metrics:

Number of Parents

Today's Completion Rate

Active Tasks

Missed Tasks

--------------------------------------------------

Parent Status Cards

Example:

Mom

Completion Rate: 92%

Breakfast: Completed

Medicine: Pending

Exercise: Completed

Status Badge

Green

Yellow

Red

--------------------------------------------------

Today's Alerts Section

Recent missed tasks

Recent escalations

--------------------------------------------------

Recent Activity Feed

Examples:

Mom completed Breakfast

Dad completed BP Medicine

Mom completed Walk

--------------------------------------------------

PARENTS PAGE

--------------------------------------------------

Display linked parents.

Each card contains:

Profile Placeholder

Parent Name

Completion Percentage

Last Activity

View Details Button

Floating Add Parent Button

--------------------------------------------------

ADD PARENT SCREEN

--------------------------------------------------

Fields:

Parent Name

Relationship

Examples:

Mom

Dad

Grandmother

Grandfather

Button:

Generate QR Code

Display generated QR code in a card.

Include:

Download QR

Share QR

--------------------------------------------------

PARENT DETAILS PAGE

--------------------------------------------------

Header:

Parent Name

Completion Rate

Statistics:

Completed Tasks

Missed Tasks

Pending Tasks

--------------------------------------------------

Recent Activity Timeline

--------------------------------------------------

Upcoming Tasks

--------------------------------------------------

Weekly Adherence Chart

--------------------------------------------------

TASKS PAGE

--------------------------------------------------

Display all care tasks.

Filters:

All

Meals

Medicines

Exercise

Appointments

Wellness

--------------------------------------------------

Task Card

Task Name

Assigned Parent

Scheduled Time

Status

--------------------------------------------------

Floating Add Task Button

--------------------------------------------------

CREATE TASK SCREEN

--------------------------------------------------

Fields:

Task Name

Category

Dropdown:

Meal

Medicine

Exercise

Appointment

Wellness

Assigned Parent

Time Picker

Repeat

Options:

Once

Daily

Weekly

Monthly

Notes

Button:

Save Task

--------------------------------------------------

ALERTS PAGE

--------------------------------------------------

Sections:

Escalations

Missed Tasks

Urgent Alerts

Use warning cards.

Priority badges:

Low

Medium

High

Critical

--------------------------------------------------

PROFILE PAGE

--------------------------------------------------

Profile Information

Family Information

Settings

Logout

--------------------------------------------------

PARENT EXPERIENCE

--------------------------------------------------

IMPORTANT:

Parent interface should be completely different.

Parent interface should be extremely simple.

No analytics.

No dashboards.

No complicated navigation.

--------------------------------------------------

PARENT HOME SCREEN

--------------------------------------------------

Show ONLY the current active task.

Example:

Good Morning Mom ❤️

Breakfast Time

Today's Breakfast:

Oats

Banana

Milk

Buttons:

[Completed]

[Snooze 10 Minutes]

Large buttons.

Large fonts.

Single-focus screen.

--------------------------------------------------

PARENT TODAY SCREEN

--------------------------------------------------

Show today's timeline.

Completed:

Green

Upcoming:

Blue

Missed:

Red

Simple vertical timeline.

--------------------------------------------------

PARENT HISTORY SCREEN

--------------------------------------------------

Last 7 Days

Simple completion summary.

No complex charts.

--------------------------------------------------

NOTIFICATION UI

--------------------------------------------------

Reminder Notification

Title:

Time For Your BP Medicine

Actions:

Completed

Snooze

--------------------------------------------------

Escalation Notification

Example:

Mom has not confirmed Breakfast

Use warning styling.

--------------------------------------------------

EMPTY STATES

--------------------------------------------------

Create beautiful empty states.

Examples:

No Tasks Scheduled

No Alerts

No Parents Linked

No Activity Yet

--------------------------------------------------

ACCESSIBILITY

--------------------------------------------------

This is extremely important.

Parent mode must support:

Large Fonts

Large Buttons

High Contrast

Simple Layouts

Maximum 1-2 taps per action

Easy readability

--------------------------------------------------

RESPONSIVE REQUIREMENTS

--------------------------------------------------

Desktop:

Sidebar Layout

Multi-column dashboards

Analytics cards

Tables where appropriate

--------------------------------------------------

Tablet:

Hybrid layout

--------------------------------------------------

Mobile:

Bottom navigation

Stacked cards

Touch-first interface

--------------------------------------------------

COMPONENTS

--------------------------------------------------

Generate reusable components:

Navbar

Sidebar

Bottom Navigation

Task Card

Parent Card

Alert Card

Statistic Card

Timeline Component

QR Card

Completion Card

Loading States

Skeletons

--------------------------------------------------

MOCK DATA

--------------------------------------------------

Generate realistic mock data for:

Parents

Tasks

Notifications

Completion History

Adherence Metrics

Alerts

--------------------------------------------------

DELIVERABLE

--------------------------------------------------

Generate:

Complete frontend architecture

Folder structure

Responsive layouts

Reusable components

Page implementations

Routing structure

Mock data

Production-quality UI

Modern startup-level design

Mobile-first experience

Desktop dashboard support

Dark mode support

All screens fully designed and connected.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4e94de3f-105c-5309-a40f-d73f7bd7c867).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
