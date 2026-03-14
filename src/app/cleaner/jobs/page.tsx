"use client";

import { useState } from "react";

type JobStatus = "pending" | "upcoming" | "in-progress" | "completed";

interface Job {
  id: string;
  clientName: string;
  address: string;
  date: string;
  time: string;
  serviceType: string;
  price: number;
  status: JobStatus;
  duration: number;
}

const mockJobs: Job[] = [
  { id: "B-1001", clientName: "Emma Wilson", address: "14 Baker St, W1U ***", date: "2026-03-14", time: "09:00", serviceType: "Regular Clean", price: 65, status: "pending", duration: 2 },
  { id: "B-1002", clientName: "James Taylor", address: "8 Canary Wharf, E14 ***", date: "2026-03-14", time: "14:00", serviceType: "Deep Clean", price: 120, status: "pending", duration: 4 },
  { id: "B-1003", clientName: "Olivia Brown", address: "22 Richmond Rd, TW9 ***", date: "2026-03-15", time: "10:00", serviceType: "End of Tenancy", price: 180, status: "upcoming", duration: 5 },
  { id: "B-1004", clientName: "Liam Johnson", address: "5 Kensington High St, W8 ***", date: "2026-03-16", time: "08:30", serviceType: "Regular Clean", price: 55, status: "upcoming", duration: 2 },
  { id: "B-1005", clientName: "Sophie Davis", address: "31 Camden Rd, NW1 ***", date: "2026-03-13", time: "11:00", serviceType: "AirBnB Turnover", price: 90, status: "in-progress", duration: 3 },
  { id: "B-1006", clientName: "Daniel Lee", address: "17 Brixton Hill, SW2 ***", date: "2026-03-12", time: "09:00", serviceType: "Deep Clean", price: 140, status: "completed", duration: 4 },
  { id: "B-1007", clientName: "Mia Clark", address: "9 Greenwich Park, SE10 ***", date: "2026-03-11", time: "14:00", serviceType: "Regular Clean", price: 60, status: "completed", duration: 2 },
  { id: "B-1008", clientName: "Noah White", address: "45 Fulham Rd, SW6 ***", date: "2026-03-10", time: "10:00", serviceType: "End of Tenancy", price: 200, status: "completed", duration: 6 },
];

const tabs: { key: JobStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "upcoming", label: "Upcoming" },
  { key: "in-progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

const emptyMessages: Record<JobStatus, { title: string; description: string }> = {
  pending: { title: "No pending jobs", description: "You have no jobs waiting for your response." },
  upcoming: { title: "No upcoming jobs", description: "You have no confirmed upcoming jobs." },
  "in-progress": { title: "No jobs in progress", description: "You are not currently working on any jobs." },
  completed: { title: "No completed jobs", description: "Your completed jobs will appear here." },
};

export default function CleanerJobsPage() {
  const [activeTab, setActiveTab] = useState<JobStatus>("pending");
  const [jobList, setJobList] = useState(mockJobs);

  const filteredJobs = jobList.filter((j) => j.status === activeTab);

  const handleAccept = (id: string) => {
    setJobList((prev) => prev.map((j) => (j.id === id ? { ...j, status: "upcoming" as const } : j)));
  };

  const handleDecline = (id: string) => {
    setJobList((prev) => prev.filter((j) => j.id !== id));
  };

  const handleStart = (id: string) => {
    setJobList((prev) => prev.map((j) => (j.id === id ? { ...j, status: "in-progress" as const } : j)));
  };

  const handleComplete = (id: string) => {
    setJobList((prev) => prev.map((j) => (j.id === id ? { ...j, status: "completed" as const } : j)));
  };

  const getStatusBadge = (status: JobStatus) => {
    const styles: Record<JobStatus, string> = {
      pending: "bg-yellow-100 text-yellow-700",
      upcoming: "bg-blue-100 text-blue-700",
      "in-progress": "bg-orange-100 text-orange-700",
      completed: "bg-green-100 text-green-700",
    };
    const labels: Record<JobStatus, string> = {
      pending: "Pending",
      upcoming: "Upcoming",
      "in-progress": "In Progress",
      completed: "Completed",
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
        <p className="text-gray-500 mt-1">Manage your cleaning bookings</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6 -mb-px overflow-x-auto">
          {tabs.map((tab) => {
            const count = jobList.filter((j) => j.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs ${
                    activeTab === tab.key ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Job list */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">{emptyMessages[activeTab].title}</h3>
          <p className="mt-1 text-sm text-gray-500">{emptyMessages[activeTab].description}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div key={job.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-semibold text-gray-900">{job.clientName}</p>
                    {getStatusBadge(job.status)}
                  </div>
                  <p className="text-sm text-gray-500">{job.address}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {job.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {job.time} ({job.duration}h)
                    </span>
                    <span className="text-blue-600 font-medium">{job.serviceType}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Ref: {job.id}</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <p className="text-xl font-bold text-gray-900">£{job.price}</p>
                  <div className="flex gap-2">
                    {job.status === "pending" && (
                      <>
                        <button onClick={() => handleAccept(job.id)} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
                          Accept
                        </button>
                        <button onClick={() => handleDecline(job.id)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                          Decline
                        </button>
                      </>
                    )}
                    {job.status === "upcoming" && (
                      <button onClick={() => handleStart(job.id)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                        Start Job
                      </button>
                    )}
                    {job.status === "in-progress" && (
                      <button onClick={() => handleComplete(job.id)} className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
                        Complete
                      </button>
                    )}
                    <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
