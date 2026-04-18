import type { Meta, StoryObj } from '@storybook/react';

// Create a simple wrapper component that displays the landing page
const LandingPage = () => {
  return (
    <iframe
      src="/landing.html"
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
        display: 'block',
      }}
      title="Landing Page"
    />
  );
};

const meta = {
  title: 'Pages/Landing',
  component: LandingPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Principal Narrative Agent landing page - AI-powered narrative coherence platform',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LandingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
