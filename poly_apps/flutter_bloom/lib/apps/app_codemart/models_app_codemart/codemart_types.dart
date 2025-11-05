import 'codemart_enums.dart';

class UserProfile {
  final int id;
  final String username;
  final String email;
  final String name;
  final String? nickname;
  final String? avatar;
  final String? about;
  final String? website;
  final String? github;
  final String? wechat;
  final List<UserRoleType> roles;
  final String? emailVerifiedAt;
  final String createdAt;
  final String updatedAt;

  UserProfile({
    required this.id,
    required this.username,
    required this.email,
    required this.name,
    this.nickname,
    this.avatar,
    this.about,
    this.website,
    this.github,
    this.wechat,
    required this.roles,
    this.emailVerifiedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as int,
      username: json['username'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      nickname: json['nickname'] as String?,
      avatar: json['avatar'] as String?,
      about: json['about'] as String?,
      website: json['website'] as String?,
      github: json['github'] as String?,
      wechat: json['wechat'] as String?,
      roles: (json['roles'] as List<dynamic>?)
              ?.map((e) => _parseUserRoleType(e as String))
              .toList() ??
          [],
      emailVerifiedAt: json['emailVerifiedAt'] as String?,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'name': name,
      'nickname': nickname,
      'avatar': avatar,
      'about': about,
      'website': website,
      'github': github,
      'wechat': wechat,
      'roles': roles.map((e) => e.name).toList(),
      'emailVerifiedAt': emailVerifiedAt,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class UserRoleTypeData {
  final int id;
  final int userId;
  final UserRoleType roleType;
  final UserRoleStatus roleStatus;
  final double depositAmount;
  final String? roleActivatedAt;

  UserRoleTypeData({
    required this.id,
    required this.userId,
    required this.roleType,
    required this.roleStatus,
    required this.depositAmount,
    this.roleActivatedAt,
  });

  factory UserRoleTypeData.fromJson(Map<String, dynamic> json) {
    return UserRoleTypeData(
      id: json['id'] as int,
      userId: json['userId'] as int,
      roleType: _parseUserRoleType(json['roleType'] as String),
      roleStatus: _parseUserRoleStatus(json['roleStatus'] as String),
      depositAmount: (json['depositAmount'] as num).toDouble(),
      roleActivatedAt: json['roleActivatedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'roleType': roleType.name,
      'roleStatus': roleStatus.name,
      'depositAmount': depositAmount,
      'roleActivatedAt': roleActivatedAt,
    };
  }
}

class DeveloperProfile {
  final int id;
  final int userId;
  final DeveloperType developerType;
  final DeveloperLevel level;
  final int points;
  final String? companyName;
  final String? bio;
  final List<String> skills;
  final List<Certification> certifications;
  final int completedProjects;
  final double averageRating;
  final int followersCount;
  final double rating;
  final VerificationStatus verificationStatus;
  final String? profileCompletedAt;

  DeveloperProfile({
    required this.id,
    required this.userId,
    required this.developerType,
    required this.level,
    required this.points,
    this.companyName,
    this.bio,
    required this.skills,
    required this.certifications,
    required this.completedProjects,
    required this.averageRating,
    required this.followersCount,
    required this.rating,
    required this.verificationStatus,
    this.profileCompletedAt,
  });

  factory DeveloperProfile.fromJson(Map<String, dynamic> json) {
    return DeveloperProfile(
      id: json['id'] as int,
      userId: json['userId'] as int,
      developerType: _parseDeveloperType(json['developerType'] as String? ?? 'regular'),
      level: _parseDeveloperLevel(json['level'] as String? ?? 'level1'),
      points: json['points'] as int? ?? 0,
      companyName: json['companyName'] as String?,
      bio: json['bio'] as String?,
      skills: (json['skills'] as List<dynamic>?)?.map((e) => e as String).toList() ?? [],
      certifications: (json['certifications'] as List<dynamic>?)
              ?.map((e) => Certification.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      completedProjects: json['completedProjects'] as int? ?? 0,
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0.0,
      followersCount: json['followersCount'] as int? ?? 0,
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      verificationStatus: _parseVerificationStatus(json['verificationStatus'] as String? ?? 'notStarted'),
      profileCompletedAt: json['profileCompletedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'developerType': developerType.name,
      'level': level.name,
      'points': points,
      'companyName': companyName,
      'bio': bio,
      'skills': skills,
      'certifications': certifications.map((e) => e.toJson()).toList(),
      'completedProjects': completedProjects,
      'averageRating': averageRating,
      'followersCount': followersCount,
      'rating': rating,
      'verificationStatus': verificationStatus.name,
      'profileCompletedAt': profileCompletedAt,
    };
  }
}

class ClientProfile {
  final int id;
  final int userId;
  final ClientType clientType;
  final ClientLevel level;
  final String companyName;
  final String? companyRegistrationNumber;
  final Industry? industry;
  final String? companyDescription;
  final String? contactPerson;
  final String? contactPhone;
  final String? companyWebsite;
  final int postedProjects;
  final int totalProjects;
  final double totalSpent;
  final double averageRating;
  final double rating;
  final VerificationStatus verificationStatus;
  final String? profileCompletedAt;

  ClientProfile({
    required this.id,
    required this.userId,
    required this.clientType,
    required this.level,
    required this.companyName,
    this.companyRegistrationNumber,
    this.industry,
    this.companyDescription,
    this.contactPerson,
    this.contactPhone,
    this.companyWebsite,
    required this.postedProjects,
    required this.totalProjects,
    required this.totalSpent,
    required this.averageRating,
    required this.rating,
    required this.verificationStatus,
    this.profileCompletedAt,
  });

  factory ClientProfile.fromJson(Map<String, dynamic> json) {
    return ClientProfile(
      id: json['id'] as int,
      userId: json['userId'] as int,
      clientType: _parseClientType(json['clientType'] as String? ?? 'individual'),
      level: _parseClientLevel(json['level'] as String? ?? 'level1'),
      companyName: json['companyName'] as String? ?? '',
      companyRegistrationNumber: json['companyRegistrationNumber'] as String?,
      industry: json['industry'] != null ? _parseIndustry(json['industry'] as String) : null,
      companyDescription: json['companyDescription'] as String?,
      contactPerson: json['contactPerson'] as String?,
      contactPhone: json['contactPhone'] as String?,
      companyWebsite: json['companyWebsite'] as String?,
      postedProjects: json['postedProjects'] as int? ?? 0,
      totalProjects: json['totalProjects'] as int? ?? 0,
      totalSpent: (json['totalSpent'] as num?)?.toDouble() ?? 0.0,
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0.0,
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      verificationStatus: _parseVerificationStatus(json['verificationStatus'] as String? ?? 'notStarted'),
      profileCompletedAt: json['profileCompletedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'clientType': clientType.name,
      'level': level.name,
      'companyName': companyName,
      'companyRegistrationNumber': companyRegistrationNumber,
      'industry': industry?.name,
      'companyDescription': companyDescription,
      'contactPerson': contactPerson,
      'contactPhone': contactPhone,
      'companyWebsite': companyWebsite,
      'postedProjects': postedProjects,
      'totalProjects': totalProjects,
      'totalSpent': totalSpent,
      'averageRating': averageRating,
      'rating': rating,
      'verificationStatus': verificationStatus.name,
      'profileCompletedAt': profileCompletedAt,
    };
  }
}

class Certification {
  final int id;
  final String name;
  final String issuer;
  final String issuedDate;
  final String? expiryDate;
  final CertificationStatus status;
  final String? credentialUrl;
  final String? credentialId;

  Certification({
    required this.id,
    required this.name,
    required this.issuer,
    required this.issuedDate,
    this.expiryDate,
    required this.status,
    this.credentialUrl,
    this.credentialId,
  });

  factory Certification.fromJson(Map<String, dynamic> json) {
    return Certification(
      id: json['id'] as int,
      name: json['name'] as String,
      issuer: json['issuer'] as String,
      issuedDate: json['issuedDate'] as String,
      expiryDate: json['expiryDate'] as String?,
      status: _parseCertificationStatus(json['status'] as String),
      credentialUrl: json['credentialUrl'] as String?,
      credentialId: json['credentialId'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'issuer': issuer,
      'issuedDate': issuedDate,
      'expiryDate': expiryDate,
      'status': status.name,
      'credentialUrl': credentialUrl,
      'credentialId': credentialId,
    };
  }
}

class Attachment {
  final int id;
  final String fileName;
  final String fileUrl;
  final AttachmentFileType fileType;
  final AttachmentType attachmentType;
  final int fileSizeBytes;
  final String uploadedAt;
  final int uploadedBy;
  final String? description;

  Attachment({
    required this.id,
    required this.fileName,
    required this.fileUrl,
    required this.fileType,
    required this.attachmentType,
    required this.fileSizeBytes,
    required this.uploadedAt,
    required this.uploadedBy,
    this.description,
  });

  factory Attachment.fromJson(Map<String, dynamic> json) {
    return Attachment(
      id: json['id'] as int,
      fileName: json['fileName'] as String,
      fileUrl: json['fileUrl'] as String,
      fileType: _parseFileType(json['fileType'] as String),
      attachmentType: _parseAttachmentType(json['attachmentType'] as String),
      fileSizeBytes: json['fileSizeBytes'] as int,
      uploadedAt: json['uploadedAt'] as String,
      uploadedBy: json['uploadedBy'] as int,
      description: json['description'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fileName': fileName,
      'fileUrl': fileUrl,
      'fileType': fileType.name,
      'attachmentType': attachmentType.name,
      'fileSizeBytes': fileSizeBytes,
      'uploadedAt': uploadedAt,
      'uploadedBy': uploadedBy,
      'description': description,
    };
  }

  // Helper to get file size in MB
  double get fileSizeMb => fileSizeBytes / (1024 * 1024);

  // Helper to check if file is an image
  bool get isImage => fileType == AttachmentFileType.image;

  // Helper to check if file is a document
  bool get isDocument => [
        AttachmentFileType.pdf,
        AttachmentFileType.doc,
        AttachmentFileType.docx,
        AttachmentFileType.xls,
        AttachmentFileType.xlsx,
        AttachmentFileType.ppt,
        AttachmentFileType.pptx,
        AttachmentFileType.txt,
      ].contains(fileType);
}

class Project {
  final int id;
  final int clientId;
  final String title;
  final String description;
  final ProjectStatus status;
  final ProjectComplexity complexity;
  final double budget;
  final String budgetType;
  final String currency;
  final String startDate;
  final String endDate;
  final List<String> skills;
  final List<ProgrammingLanguage> languages;
  final List<Framework> frameworks;
  final List<Database> databases;
  final List<Attachment> attachments;
  final List<String> referenceUrls;
  final int totalMilestones;
  final int completedMilestones;
  final Milestone? currentMilestone;
  final ProjectProposal? aiProposal;
  final String createdAt;
  final String updatedAt;

  Project({
    required this.id,
    required this.clientId,
    required this.title,
    required this.description,
    required this.status,
    required this.complexity,
    required this.budget,
    required this.budgetType,
    required this.currency,
    required this.startDate,
    required this.endDate,
    required this.skills,
    required this.languages,
    required this.frameworks,
    required this.databases,
    required this.attachments,
    required this.referenceUrls,
    required this.totalMilestones,
    required this.completedMilestones,
    this.currentMilestone,
    this.aiProposal,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Project.fromJson(Map<String, dynamic> json) {
    return Project(
      id: json['id'] as int,
      clientId: json['clientId'] as int,
      title: json['title'] as String,
      description: json['description'] as String,
      status: _parseProjectStatus(json['status'] as String),
      complexity: _parseProjectComplexity(json['complexity'] as String),
      budget: (json['budget'] as num).toDouble(),
      budgetType: json['budgetType'] as String,
      currency: json['currency'] as String,
      startDate: json['startDate'] as String,
      endDate: json['endDate'] as String,
      skills: (json['skills'] as List<dynamic>?)?.map((e) => e as String).toList() ?? [],
      languages: (json['languages'] as List<dynamic>?)
              ?.map((e) => _parseProgrammingLanguage(e as String))
              .toList() ??
          [],
      frameworks: (json['frameworks'] as List<dynamic>?)?.map((e) => _parseFramework(e as String)).toList() ?? [],
      databases: (json['databases'] as List<dynamic>?)?.map((e) => _parseDatabase(e as String)).toList() ?? [],
      attachments: (json['attachments'] as List<dynamic>?)
              ?.map((e) => Attachment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      referenceUrls: (json['referenceUrls'] as List<dynamic>?)?.map((e) => e as String).toList() ?? [],
      totalMilestones: json['totalMilestones'] as int,
      completedMilestones: json['completedMilestones'] as int,
      currentMilestone: json['currentMilestone'] != null
          ? Milestone.fromJson(json['currentMilestone'] as Map<String, dynamic>)
          : null,
      aiProposal:
          json['aiProposal'] != null ? ProjectProposal.fromJson(json['aiProposal'] as Map<String, dynamic>) : null,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'clientId': clientId,
      'title': title,
      'description': description,
      'status': status.name,
      'complexity': complexity.name,
      'budget': budget,
      'budgetType': budgetType,
      'currency': currency,
      'startDate': startDate,
      'endDate': endDate,
      'skills': skills,
      'languages': languages.map((e) => e.name).toList(),
      'frameworks': frameworks.map((e) => e.name).toList(),
      'databases': databases.map((e) => e.name).toList(),
      'attachments': attachments.map((e) => e.toJson()).toList(),
      'referenceUrls': referenceUrls,
      'totalMilestones': totalMilestones,
      'completedMilestones': completedMilestones,
      'currentMilestone': currentMilestone?.toJson(),
      'aiProposal': aiProposal?.toJson(),
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class ProjectProposal {
  final int id;
  final int projectId;
  final int? architectId;
  final ProjectStatus status;
  final RecommendedTechStack recommendedTechStack;
  final SuggestedTeamComposition suggestedTeamComposition;
  final int estimatedDuration;
  final double estimatedCost;
  final String proposalDescription;
  final DateTime? estimatedStartDate;
  final DateTime? estimatedEndDate;
  final List<ProposalMilestone> milestones;
  final List<CostBreakdownItem> costBreakdown;
  final String aiNotes;
  final String generatedAt;

  ProjectProposal({
    required this.id,
    required this.projectId,
    this.architectId,
    required this.status,
    required this.recommendedTechStack,
    required this.suggestedTeamComposition,
    required this.estimatedDuration,
    required this.estimatedCost,
    this.proposalDescription = '',
    this.estimatedStartDate,
    this.estimatedEndDate,
    this.milestones = const [],
    required this.costBreakdown,
    required this.aiNotes,
    required this.generatedAt,
  });

  factory ProjectProposal.fromJson(Map<String, dynamic> json) {
    return ProjectProposal(
      id: json['id'] as int,
      projectId: json['projectId'] as int,
      architectId: json['architectId'] as int?,
      status: _parseProjectStatus(json['status'] as String),
      recommendedTechStack: RecommendedTechStack.fromJson(json['recommendedTechStack'] as Map<String, dynamic>),
      suggestedTeamComposition:
          SuggestedTeamComposition.fromJson(json['suggestedTeamComposition'] as Map<String, dynamic>),
      estimatedDuration: json['estimatedDuration'] as int,
      estimatedCost: (json['estimatedCost'] as num).toDouble(),
      proposalDescription: json['proposalDescription'] as String? ?? '',
      estimatedStartDate: _parseDateTime(json['estimatedStartDate']),
      estimatedEndDate: _parseDateTime(json['estimatedEndDate']),
      milestones: (json['milestones'] as List<dynamic>?)
              ?.map((e) => ProposalMilestone.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      costBreakdown: (json['costBreakdown'] as List<dynamic>)
          .map((e) => CostBreakdownItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      aiNotes: json['aiNotes'] as String,
      generatedAt: json['generatedAt'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'projectId': projectId,
      'architectId': architectId,
      'status': status.name,
      'recommendedTechStack': recommendedTechStack.toJson(),
      'suggestedTeamComposition': suggestedTeamComposition.toJson(),
      'estimatedDuration': estimatedDuration,
      'estimatedCost': estimatedCost,
      'proposalDescription': proposalDescription,
      'estimatedStartDate': estimatedStartDate?.toIso8601String(),
      'estimatedEndDate': estimatedEndDate?.toIso8601String(),
      'milestones': milestones.map((e) => e.toJson()).toList(),
      'costBreakdown': costBreakdown.map((e) => e.toJson()).toList(),
      'aiNotes': aiNotes,
      'generatedAt': generatedAt,
    };
  }
}

class RecommendedTechStack {
  final List<ProgrammingLanguage> languages;
  final List<Framework> frameworks;
  final List<Database> databases;

  RecommendedTechStack({
    required this.languages,
    required this.frameworks,
    required this.databases,
  });

  factory RecommendedTechStack.fromJson(Map<String, dynamic> json) {
    return RecommendedTechStack(
      languages: (json['languages'] as List<dynamic>).map((e) => _parseProgrammingLanguage(e as String)).toList(),
      frameworks: (json['frameworks'] as List<dynamic>).map((e) => _parseFramework(e as String)).toList(),
      databases: (json['databases'] as List<dynamic>).map((e) => _parseDatabase(e as String)).toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'languages': languages.map((e) => e.name).toList(),
      'frameworks': frameworks.map((e) => e.name).toList(),
      'databases': databases.map((e) => e.name).toList(),
    };
  }
}

class SuggestedTeamComposition {
  final int seniorDevelopers;
  final int midLevelDevelopers;
  final int juniorDevelopers;

  SuggestedTeamComposition({
    required this.seniorDevelopers,
    required this.midLevelDevelopers,
    required this.juniorDevelopers,
  });

  factory SuggestedTeamComposition.fromJson(Map<String, dynamic> json) {
    return SuggestedTeamComposition(
      seniorDevelopers: json['seniorDevelopers'] as int,
      midLevelDevelopers: json['midLevelDevelopers'] as int,
      juniorDevelopers: json['juniorDevelopers'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'seniorDevelopers': seniorDevelopers,
      'midLevelDevelopers': midLevelDevelopers,
      'juniorDevelopers': juniorDevelopers,
    };
  }
}

class CostBreakdownItem {
  final String description;
  final int hours;
  final double hourlyRate;
  final double subtotal;

  CostBreakdownItem({
    required this.description,
    required this.hours,
    required this.hourlyRate,
    required this.subtotal,
  });

  factory CostBreakdownItem.fromJson(Map<String, dynamic> json) {
    return CostBreakdownItem(
      description: json['description'] as String,
      hours: json['hours'] as int,
      hourlyRate: (json['hourlyRate'] as num).toDouble(),
      subtotal: (json['subtotal'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'description': description,
      'hours': hours,
      'hourlyRate': hourlyRate,
      'subtotal': subtotal,
    };
  }
}

class ProposalMilestone {
  final String title;
  final String description;
  final DateTime? dueDate;
  final double payment;

  ProposalMilestone({
    required this.title,
    required this.description,
    this.dueDate,
    required this.payment,
  });

  factory ProposalMilestone.fromJson(Map<String, dynamic> json) {
    return ProposalMilestone(
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      dueDate: _parseDateTime(json['dueDate']),
      payment: (json['payment'] as num?)?.toDouble() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'description': description,
      'dueDate': dueDate?.toIso8601String(),
      'payment': payment,
    };
  }
}

class Milestone {
  final int id;
  final int projectId;
  final String title;
  final String description;
  final MilestoneStatus status;
  final int order;
  final String dueDate;
  final double budget;
  final List<String> deliverables;
  final List<Task> tasks;
  final String? completedAt;
  final String createdAt;

  Milestone({
    required this.id,
    required this.projectId,
    required this.title,
    required this.description,
    required this.status,
    required this.order,
    required this.dueDate,
    required this.budget,
    required this.deliverables,
    required this.tasks,
    this.completedAt,
    required this.createdAt,
  });

  factory Milestone.fromJson(Map<String, dynamic> json) {
    return Milestone(
      id: json['id'] as int,
      projectId: json['projectId'] as int,
      title: json['title'] as String,
      description: json['description'] as String,
      status: _parseMilestoneStatus(json['status'] as String),
      order: json['order'] as int,
      dueDate: json['dueDate'] as String,
      budget: (json['budget'] as num).toDouble(),
      deliverables: (json['deliverables'] as List<dynamic>?)?.map((e) => e as String).toList() ?? [],
      tasks: (json['tasks'] as List<dynamic>?)?.map((e) => Task.fromJson(e as Map<String, dynamic>)).toList() ?? [],
      completedAt: json['completedAt'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'projectId': projectId,
      'title': title,
      'description': description,
      'status': status.name,
      'order': order,
      'dueDate': dueDate,
      'budget': budget,
      'deliverables': deliverables,
      'tasks': tasks.map((e) => e.toJson()).toList(),
      'completedAt': completedAt,
      'createdAt': createdAt,
    };
  }
}

class Task {
  final int id;
  final int projectId;
  final int? milestoneId;
  final String title;
  final String description;
  final TaskStatus status;
  final TaskPriority priority;
  final int? assignedTo;
  final int createdBy;
  final int estimatedHours;
  final int? actualHours;
  final String dueDate;
  final double budget;
  final List<String> skills;
  final List<Attachment> attachments;
  final String createdAt;
  final String updatedAt;

  Task({
    required this.id,
    required this.projectId,
    this.milestoneId,
    required this.title,
    required this.description,
    required this.status,
    required this.priority,
    this.assignedTo,
    required this.createdBy,
    required this.estimatedHours,
    this.actualHours,
    required this.dueDate,
    required this.budget,
    required this.skills,
    required this.attachments,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: json['id'] as int,
      projectId: json['projectId'] as int,
      milestoneId: json['milestoneId'] as int?,
      title: json['title'] as String,
      description: json['description'] as String,
      status: _parseTaskStatus(json['status'] as String),
      priority: _parseTaskPriority(json['priority'] as String),
      assignedTo: json['assignedTo'] as int?,
      createdBy: json['createdBy'] as int,
      estimatedHours: json['estimatedHours'] as int,
      actualHours: json['actualHours'] as int?,
      dueDate: json['dueDate'] as String,
      budget: (json['budget'] as num).toDouble(),
      skills: (json['skills'] as List<dynamic>?)?.map((e) => e as String).toList() ?? [],
      attachments: (json['attachments'] as List<dynamic>?)
              ?.map((e) => Attachment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'projectId': projectId,
      'milestoneId': milestoneId,
      'title': title,
      'description': description,
      'status': status.name,
      'priority': priority.name,
      'assignedTo': assignedTo,
      'createdBy': createdBy,
      'estimatedHours': estimatedHours,
      'actualHours': actualHours,
      'dueDate': dueDate,
      'budget': budget,
      'skills': skills,
      'attachments': attachments.map((e) => e.toJson()).toList(),
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class PaginatedResponse<T> {
  final List<T> items;
  final int total;
  final int page;
  final int pageSize;
  final int totalPages;

  PaginatedResponse({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
    required this.totalPages,
  });

  factory PaginatedResponse.fromJson(Map<String, dynamic> json, T Function(Map<String, dynamic>) fromJsonT) {
    return PaginatedResponse(
      items: (json['items'] as List<dynamic>).map((e) => fromJsonT(e as Map<String, dynamic>)).toList(),
      total: json['total'] as int,
      page: json['page'] as int,
      pageSize: json['pageSize'] as int,
      totalPages: json['totalPages'] as int,
    );
  }

  Map<String, dynamic> toJson(Map<String, dynamic> Function(T) toJsonT) {
    return {
      'items': items.map((e) => toJsonT(e)).toList(),
      'total': total,
      'page': page,
      'pageSize': pageSize,
      'totalPages': totalPages,
    };
  }
}

class ApiResponse<T> {
  final bool success;
  final int code;
  final String message;
  final T? data;
  final String? error;
  final String timestamp;

  ApiResponse({
    required this.success,
    required this.code,
    required this.message,
    this.data,
    this.error,
    required this.timestamp,
  });

  factory ApiResponse.fromJson(Map<String, dynamic> json, T Function(dynamic)? fromJsonT) {
    return ApiResponse(
      success: json['success'] as bool,
      code: json['code'] as int,
      message: json['message'] as String,
      data: json['data'] != null && fromJsonT != null ? fromJsonT(json['data']) : null,
      error: json['error'] as String?,
      timestamp: json['timestamp'] as String,
    );
  }

  Map<String, dynamic> toJson(dynamic Function(T)? toJsonT) {
    return {
      'success': success,
      'code': code,
      'message': message,
      'data': data != null && toJsonT != null ? toJsonT(data as T) : data,
      'error': error,
      'timestamp': timestamp,
    };
  }
}

UserRoleType _parseUserRoleType(String value) {
  return UserRoleType.values.firstWhere(
    (e) => e.name == value,
    orElse: () => UserRoleType.developer,
  );
}

UserRoleStatus _parseUserRoleStatus(String value) {
  return UserRoleStatus.values.firstWhere(
    (e) => e.name == value,
    orElse: () => UserRoleStatus.pending,
  );
}

CertificationStatus _parseCertificationStatus(String value) {
  return CertificationStatus.values.firstWhere(
    (e) => e.name == value,
    orElse: () => CertificationStatus.pending,
  );
}

Industry _parseIndustry(String value) {
  return Industry.values.firstWhere(
    (e) => e.name == value,
    orElse: () => Industry.other,
  );
}

ProjectStatus _parseProjectStatus(String value) {
  final normalized = value.replaceAll('_', '').toLowerCase();
  return ProjectStatus.values.firstWhere(
    (e) => e.name.replaceAll('_', '').toLowerCase() == normalized,
    orElse: () => ProjectStatus.draft,
  );
}

ProjectComplexity _parseProjectComplexity(String value) {
  final normalized = value.replaceAll('_', '').toLowerCase();
  return ProjectComplexity.values.firstWhere(
    (e) => e.name.replaceAll('_', '').toLowerCase() == normalized,
    orElse: () => ProjectComplexity.simple,
  );
}

ProgrammingLanguage _parseProgrammingLanguage(String value) {
  return ProgrammingLanguage.values.firstWhere(
    (e) => e.name == value,
    orElse: () => ProgrammingLanguage.javascript,
  );
}

Framework _parseFramework(String value) {
  return Framework.values.firstWhere(
    (e) => e.name == value,
    orElse: () => Framework.react,
  );
}

Database _parseDatabase(String value) {
  return Database.values.firstWhere(
    (e) => e.name == value,
    orElse: () => Database.mysql,
  );
}

DateTime? _parseDateTime(dynamic value) {
  if (value == null) {
    return null;
  }

  if (value is DateTime) {
    return value;
  }

  if (value is String && value.trim().isNotEmpty) {
    return DateTime.tryParse(value.trim());
  }

  return null;
}

MilestoneStatus _parseMilestoneStatus(String value) {
  final normalized = value.replaceAll('_', '').toLowerCase();
  return MilestoneStatus.values.firstWhere(
    (e) => e.name.replaceAll('_', '').toLowerCase() == normalized,
    orElse: () => MilestoneStatus.pending,
  );
}

TaskStatus _parseTaskStatus(String value) {
  final normalized = value.replaceAll('_', '').toLowerCase();
  return TaskStatus.values.firstWhere(
    (e) => e.name.replaceAll('_', '').toLowerCase() == normalized,
    orElse: () => TaskStatus.open,
  );
}

TaskPriority _parseTaskPriority(String value) {
  return TaskPriority.values.firstWhere(
    (e) => e.name == value,
    orElse: () => TaskPriority.medium,
  );
}

DeveloperType _parseDeveloperType(String value) {
  return DeveloperType.values.firstWhere(
    (e) => e.name == value,
    orElse: () => DeveloperType.regular,
  );
}

DeveloperLevel _parseDeveloperLevel(String value) {
  return DeveloperLevel.values.firstWhere(
    (e) => e.name == value,
    orElse: () => DeveloperLevel.level1,
  );
}

ClientType _parseClientType(String value) {
  return ClientType.values.firstWhere(
    (e) => e.name == value,
    orElse: () => ClientType.individual,
  );
}

ClientLevel _parseClientLevel(String value) {
  return ClientLevel.values.firstWhere(
    (e) => e.name == value,
    orElse: () => ClientLevel.level1,
  );
}

VerificationStatus _parseVerificationStatus(String value) {
  return VerificationStatus.values.firstWhere(
    (e) => e.name == value,
    orElse: () => VerificationStatus.notStarted,
  );
}

AttachmentFileType _parseFileType(String value) {
  return AttachmentFileType.values.firstWhere(
    (e) => e.name == value,
    orElse: () => AttachmentFileType.pdf,
  );
}

AttachmentType _parseAttachmentType(String value) {
  return AttachmentType.values.firstWhere(
    (e) => e.name == value,
    orElse: () => AttachmentType.other,
  );
}
