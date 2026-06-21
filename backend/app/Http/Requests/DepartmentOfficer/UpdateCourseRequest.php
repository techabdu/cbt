<?php

namespace App\Http\Requests\DepartmentOfficer;

use App\Enums\Semester;
use App\Enums\StudentLevel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId = $this->attributes->get('school_id');
        $courseId = $this->route('course')?->id;

        return [
            'title'         => ['required', 'string', 'max:255'],
            'code'          => ['required', 'string', 'max:20',
                Rule::unique('courses', 'code')->where('school_id', $schoolId)->ignore($courseId)],
            'credit_units'  => ['required', 'integer', 'min:1', 'max:10'],
            'level'         => ['required', Rule::enum(StudentLevel::class)],
            'semester'      => ['required', Rule::enum(Semester::class)],
        ];
    }
}
